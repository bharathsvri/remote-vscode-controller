using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class DesktopStreamer {
    private static int _port = 14500;
    private static int _fps = 30;
    private static int _quality = 75;
    private static ImageCodecInfo _jpegEncoder;
    private static EncoderParameters _encoderParams;
    private static byte[] _latestFrame;
    private static readonly object _frameLock = new object();
    private static AutoResetEvent _newFrameEvent = new AutoResetEvent(false);
    private static bool _running = true;

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern bool GetCursorInfo(out CURSORINFO pci);

    [DllImport("user32.dll")]
    static extern bool DrawIcon(IntPtr hDC, int X, int Y, IntPtr hIcon);

    [StructLayout(LayoutKind.Sequential)]
    struct POINT { public int x; public int y; }

    [StructLayout(LayoutKind.Sequential)]
    struct CURSORINFO {
        public Int32 cbSize;
        public Int32 flags;
        public IntPtr hCursor;
        public POINT ptScreenPos;
    }

    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;

    public static void Main(string[] args) {
        try {
            SetProcessDPIAware();
        } catch {}

        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "--port" && i + 1 < args.Length) int.TryParse(args[i + 1], out _port);
            if (args[i] == "--fps" && i + 1 < args.Length) int.TryParse(args[i + 1], out _fps);
            if (args[i] == "--quality" && i + 1 < args.Length) int.TryParse(args[i + 1], out _quality);
        }

        InitEncoder();

        Thread captureThread = new Thread(CaptureLoop) { IsBackground = true };
        captureThread.Start();

        StartSocketServer();
    }

    private static void InitEncoder() {
        foreach (var codec in ImageCodecInfo.GetImageEncoders()) {
            if (codec.FormatID == ImageFormat.Jpeg.Guid) {
                _jpegEncoder = codec;
                break;
            }
        }
        _encoderParams = new EncoderParameters(1);
        _encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)_quality);
    }

    private static void AttachToInputDesktop() {
        try {
            IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hInputDesk != IntPtr.Zero) {
                SetThreadDesktop(hInputDesk);
                CloseDesktop(hInputDesk);
            }
        } catch {}
    }

    private static void CaptureLoop() {
        AttachToInputDesktop();

        int sleepMs = Math.Max(10, 1000 / _fps);

        while (_running) {
            try {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                if (bounds.Width <= 0 || bounds.Height <= 0) {
                    bounds = new Rectangle(0, 0, 1920, 1080);
                }

                using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb))
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.InterpolationMode = InterpolationMode.Low;
                    g.CompositingQuality = CompositingQuality.HighSpeed;
                    g.SmoothingMode = SmoothingMode.HighSpeed;

                    int failCount = 0;
                    while (_running) {
                        try {
                            g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
                            failCount = 0;

                            // Draw cursor overlay
                            try {
                                CURSORINFO pci;
                                pci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
                                if (GetCursorInfo(out pci) && pci.flags == 0x00000001) {
                                    DrawIcon(g.GetHdc(), pci.ptScreenPos.x - bounds.X, pci.ptScreenPos.y - bounds.Y, pci.hCursor);
                                    g.ReleaseHdc();
                                }
                            } catch {}

                            using (MemoryStream ms = new MemoryStream()) {
                                bmp.Save(ms, _jpegEncoder, _encoderParams);
                                byte[] frame = ms.ToArray();
                                lock (_frameLock) {
                                    _latestFrame = frame;
                                }
                                _newFrameEvent.Set();
                            }
                        } catch {
                            failCount++;
                            if (failCount > 3) {
                                // Re-attach to input desktop if handle was invalidated or desktop switched
                                AttachToInputDesktop();
                                failCount = 0;
                            }
                        }

                        Thread.Sleep(sleepMs);
                    }
                }
            } catch {
                Thread.Sleep(500);
                AttachToInputDesktop();
            }
        }
    }

    private static void StartSocketServer() {
        TcpListener listener = new TcpListener(IPAddress.Any, _port);
        listener.Start(100);

        Console.WriteLine("[DesktopStreamer] Listening on 0.0.0.0:" + _port + " at " + _fps + " FPS (quality " + _quality + ")");

        while (_running) {
            try {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem((c) => HandleClient((TcpClient)c), client);
            } catch {
                if (!_running) break;
            }
        }
    }

    private static void HandleClient(TcpClient client) {
        try {
            client.NoDelay = true;
            NetworkStream stream = client.GetStream();
            StreamReader reader = new StreamReader(stream, Encoding.UTF8);

            string reqLine = reader.ReadLine();
            if (string.IsNullOrEmpty(reqLine)) {
                client.Close();
                return;
            }

            int contentLength = 0;
            string headerLine;
            while (!string.IsNullOrEmpty(headerLine = reader.ReadLine())) {
                if (headerLine.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) {
                    int.TryParse(headerLine.Substring(15).Trim(), out contentLength);
                }
            }

            string[] parts = reqLine.Split(' ');
            string method = parts.Length > 0 ? parts[0].ToUpper() : "GET";
            string path = parts.Length > 1 ? parts[1].ToLower() : "/";

            if (method == "OPTIONS") {
                byte[] resp = Encoding.UTF8.GetBytes(
                    "HTTP/1.1 204 No Content\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                    "Access-Control-Allow-Headers: *\r\n\r\n"
                );
                stream.Write(resp, 0, resp.Length);
                client.Close();
                return;
            }

            if (path.StartsWith("/stream")) {
                ServeMjpeg(client, stream);
                return;
            } else if (path.StartsWith("/snapshot") || path.StartsWith("/frame")) {
                ServeSnapshot(client, stream);
                return;
            } else if (path.StartsWith("/info")) {
                Rectangle b = Screen.PrimaryScreen.Bounds;
                string json = string.Format("{{\"width\":{0},\"height\":{1},\"fps\":{2}}}", b.Width, b.Height, _fps);
                byte[] body = Encoding.UTF8.GetBytes(json);
                byte[] headers = Encoding.UTF8.GetBytes(
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: application/json\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Content-Length: " + body.Length + "\r\n\r\n"
                );
                stream.Write(headers, 0, headers.Length);
                stream.Write(body, 0, body.Length);
                client.Close();
                return;
            } else if (path.StartsWith("/input") && method == "POST") {
                char[] bodyChars = new char[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = reader.Read(bodyChars, read, contentLength - read);
                    if (r <= 0) break;
                    read += r;
                }
                string bodyStr = new string(bodyChars, 0, read);
                ProcessInput(bodyStr);

                byte[] resp = Encoding.UTF8.GetBytes(
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: application/json\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Content-Length: 11\r\n\r\n{\"ok\":true}"
                );
                stream.Write(resp, 0, resp.Length);
                client.Close();
                return;
            } else {
                byte[] body = Encoding.UTF8.GetBytes("Desktop Streamer Running\n");
                byte[] headers = Encoding.UTF8.GetBytes(
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Content-Length: " + body.Length + "\r\n\r\n"
                );
                stream.Write(headers, 0, headers.Length);
                stream.Write(body, 0, body.Length);
                client.Close();
                return;
            }
        } catch {
            try { client.Close(); } catch {}
        }
    }

    private static void ServeSnapshot(TcpClient client, NetworkStream stream) {
        try {
            byte[] frame;
            lock (_frameLock) {
                frame = _latestFrame;
            }

            if (frame == null || frame.Length == 0) {
                _newFrameEvent.WaitOne(500);
                lock (_frameLock) {
                    frame = _latestFrame;
                }
            }

            if (frame != null && frame.Length > 0) {
                byte[] headers = Encoding.UTF8.GetBytes(
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Cache-Control: no-cache, no-store\r\n" +
                    "Content-Length: " + frame.Length + "\r\n\r\n"
                );
                stream.Write(headers, 0, headers.Length);
                stream.Write(frame, 0, frame.Length);
            }
        } catch {}
        try { client.Close(); } catch {}
    }

    private static void ServeMjpeg(TcpClient client, NetworkStream stream) {
        try {
            byte[] initHeader = Encoding.UTF8.GetBytes(
                "HTTP/1.1 200 OK\r\n" +
                "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                "Pragma: no-cache\r\n" +
                "Connection: close\r\n\r\n"
            );
            stream.Write(initHeader, 0, initHeader.Length);

            while (_running && client.Connected) {
                _newFrameEvent.WaitOne(100);

                byte[] frame;
                lock (_frameLock) {
                    frame = _latestFrame;
                }

                if (frame != null && frame.Length > 0) {
                    string partHeader = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + frame.Length + "\r\n\r\n";
                    byte[] partBytes = Encoding.ASCII.GetBytes(partHeader);
                    stream.Write(partBytes, 0, partBytes.Length);
                    stream.Write(frame, 0, frame.Length);
                    stream.Write(new byte[] { 13, 10 }, 0, 2);
                    stream.Flush();
                }
            }
        } catch {}
        try { client.Close(); } catch {}
    }

    private static void ProcessInput(string body) {
        try {
            string type = GetJsonVal(body, "type");
            string action = GetJsonVal(body, "action");

            if (type == "mouse") {
                double nx = 0, ny = 0;
                double.TryParse(GetJsonVal(body, "x"), out nx);
                double.TryParse(GetJsonVal(body, "y"), out ny);
                int button = 0;
                int.TryParse(GetJsonVal(body, "button"), out button);
                int delta = 0;
                int.TryParse(GetJsonVal(body, "delta"), out delta);

                uint absX = (uint)Math.Max(0, Math.Min(65535, nx * 65535));
                uint absY = (uint)Math.Max(0, Math.Min(65535, ny * 65535));

                if (action == "move") {
                    mouse_event(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, absX, absY, 0, UIntPtr.Zero);
                } else if (action == "down") {
                    uint flag = (button == 2) ? MOUSEEVENTF_RIGHTDOWN : (button == 1) ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_LEFTDOWN;
                    mouse_event(flag | MOUSEEVENTF_ABSOLUTE, absX, absY, 0, UIntPtr.Zero);
                } else if (action == "up") {
                    uint flag = (button == 2) ? MOUSEEVENTF_RIGHTUP : (button == 1) ? MOUSEEVENTF_MIDDLEUP : MOUSEEVENTF_LEFTUP;
                    mouse_event(flag | MOUSEEVENTF_ABSOLUTE, absX, absY, 0, UIntPtr.Zero);
                } else if (action == "wheel") {
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
                }
            } else if (type == "keyboard") {
                byte vk = 0;
                byte.TryParse(GetJsonVal(body, "keyCode"), out vk);
                if (vk > 0) {
                    if (action == "down") {
                        keybd_event(vk, 0, 0, UIntPtr.Zero);
                    } else if (action == "up") {
                        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }
                }
            }
        } catch {}
    }

    private static string GetJsonVal(string json, string key) {
        string pattern = "\"" + key + "\":";
        int idx = json.IndexOf(pattern);
        if (idx < 0) return "";
        int start = idx + pattern.Length;
        while (start < json.Length && (json[start] == ' ' || json[start] == '"')) start++;
        int end = start;
        while (end < json.Length && json[end] != '"' && json[end] != ',' && json[end] != '}') end++;
        return json.Substring(start, end - start).Trim();
    }
}
