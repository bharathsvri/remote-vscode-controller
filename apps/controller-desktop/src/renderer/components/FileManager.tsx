import React, { useState, useEffect } from 'react';
import { FileNode } from '@remote-vscode/shared';
import { signalingClient } from '../services/signalingClient';
import {
  Folder,
  File,
  FileCode,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  ArrowLeft,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface FileManagerProps {
  sessionId: string;
  targetDeviceId: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ sessionId, targetDeviceId }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active file being viewed/edited
  const [activeFile, setActiveFile] = useState<{ path: string; content: string; original: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileNode[] | null>(null);

  // New item modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemIsDir, setNewItemIsDir] = useState(false);

  const loadDirectory = async (relPath: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const resp = await signalingClient.listFiles(sessionId, targetDeviceId, relPath);
      setItems(resp.items);
      setCurrentPath(resp.relativePath);
      setSearchResults(null);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('');
  }, [sessionId, targetDeviceId]);

  const handleItemClick = async (item: FileNode) => {
    if (item.isDirectory) {
      loadDirectory(item.relativePath);
    } else {
      // Read file
      setLoading(true);
      try {
        const resp = await signalingClient.readFile(sessionId, targetDeviceId, item.relativePath);
        setActiveFile({
          path: item.relativePath,
          content: resp.content,
          original: resp.content,
        });
      } catch (err: any) {
        setError(`Failed to read file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      await signalingClient.writeFile(sessionId, targetDeviceId, activeFile.path, activeFile.content);
      setActiveFile({ ...activeFile, original: activeFile.content });
    } catch (err: any) {
      setError(`Failed to save file: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete '${item.name}'?`)) return;

    try {
      await signalingClient.deleteFile(sessionId, targetDeviceId, item.relativePath, item.isDirectory);
      loadDirectory(currentPath);
      if (activeFile?.path === item.relativePath) {
        setActiveFile(null);
      }
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const fullRelPath = currentPath ? `${currentPath}/${newItemName.trim()}` : newItemName.trim();
    try {
      await signalingClient.createFile(sessionId, targetDeviceId, fullRelPath, newItemIsDir);
      setShowCreateModal(false);
      setNewItemName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Create failed: ${err.message}`);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    try {
      const resp = await signalingClient.searchFiles(sessionId, targetDeviceId, searchQuery.trim());
      setSearchResults(resp.results);
    } catch (err: any) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#2d2d2d] text-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#2d2d2d]">
        <span className="font-semibold text-xs tracking-wider uppercase text-gray-400">Workspace Files</span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => loadDirectory(currentPath)}
            title="Refresh"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#333]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            title="New File or Folder"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#333]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Path breadcrumb / Nav */}
      <div className="flex items-center px-3 py-1.5 bg-[#181818] border-b border-[#2d2d2d] text-xs text-gray-300">
        {currentPath ? (
          <button
            onClick={() => {
              const parts = currentPath.split('/');
              parts.pop();
              loadDirectory(parts.join('/'));
            }}
            className="mr-2 text-blue-400 hover:underline flex items-center"
          >
            <ArrowLeft className="w-3 h-3 mr-0.5" /> Up
          </button>
        ) : null}
        <span className="truncate font-mono">/{currentPath}</span>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="px-3 py-1.5 bg-[#252526] border-b border-[#2d2d2d] flex">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
          <input
            type="text"
            placeholder="Search workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-[#1e1e1e] border border-[#3c3c3c] rounded text-gray-200 focus:outline-none focus:border-[#007acc]"
          />
        </div>
      </form>

      {/* Error alert */}
      {error && (
        <div className="px-3 py-1.5 bg-red-900/40 border-b border-red-700/50 text-red-200 text-xs flex items-center justify-between">
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Content Area: File Editor OR File Tree */}
      {activeFile ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] text-xs">
            <span className="font-mono truncate text-gray-200">{activeFile.path}</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveFile}
                disabled={isSaving || activeFile.content === activeFile.original}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-[#007acc] hover:bg-[#0062a3] disabled:opacity-40 text-white rounded text-[11px]"
              >
                <Save className="w-3 h-3" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                onClick={() => setActiveFile(null)}
                className="px-2 py-0.5 text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
          <textarea
            value={activeFile.content}
            onChange={(e) => setActiveFile({ ...activeFile, content: e.target.value })}
            className="flex-1 w-full p-3 font-mono text-xs bg-[#181818] text-gray-200 resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {(searchResults || items).length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">No items found</div>
          ) : (
            <div className="py-1">
              {(searchResults || items).map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer group text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    {item.isDirectory ? (
                      <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    ) : item.name.endsWith('.ts') || item.name.endsWith('.js') || item.name.endsWith('.json') ? (
                      <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate text-gray-300">{item.name}</span>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.isDirectory && (
                      <span className="text-[10px] text-gray-500">
                        {(item.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteItem(item, e)}
                      title="Delete"
                      className="p-1 hover:text-red-400 text-gray-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateSubmit} className="bg-[#252526] p-4 rounded-lg w-72 shadow-xl border border-[#3c3c3c]">
            <h3 className="text-sm font-semibold mb-3">Create New Item</h3>
            <input
              type="text"
              placeholder="Filename or folder name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-[#1e1e1e] border border-[#3c3c3c] rounded mb-3 text-gray-200 focus:outline-none focus:border-[#007acc]"
              autoFocus
            />
            <div className="flex items-center space-x-2 mb-4 text-xs">
              <input
                type="checkbox"
                id="isDir"
                checked={newItemIsDir}
                onChange={(e) => setNewItemIsDir(e.target.checked)}
              />
              <label htmlFor="isDir">Create as Folder</label>
            </div>
            <div className="flex justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 bg-[#333] hover:bg-[#444] rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#007acc] hover:bg-[#0062a3] text-white rounded"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
