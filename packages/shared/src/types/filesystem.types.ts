export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: number;
  extension?: string;
  isReadOnly?: boolean;
}

export interface DirectoryListRequest {
  path?: string;
}

export interface DirectoryListResponse {
  currentPath: string;
  relativePath: string;
  items: FileNode[];
}

export interface FileReadRequest {
  path: string;
}

export interface FileReadResponse {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
}

export interface FileWriteRequest {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

export interface FileDeleteRequest {
  path: string;
  isDirectory?: boolean;
}

export interface FileCreateRequest {
  path: string;
  isDirectory: boolean;
}

export interface FileRenameRequest {
  oldPath: string;
  newPath: string;
}

export interface FileSearchRequest {
  query: string;
  maxResults?: number;
}
