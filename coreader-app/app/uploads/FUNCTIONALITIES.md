# Uploads Page Functionalities

This document describes all functionalities available on the Uploads page (`/uploads`) of the CoReader application.

## Overview

The Uploads page allows users to upload book files (currently `.txt` files), monitor their processing status, and manage uploaded files. Files are processed asynchronously by a worker service, and once completed, they are converted into readable books available in the Library.

## Page Structure

### 1. Page Header
- **Label**: "Uploads"
- **Title**: "Files"
- **Description**: "Uploaded files appear here while they are processed into readable books."
- **Action Buttons**:
  - **Library**: Navigates to `/library` - Access your processed books
  - **Shop** (disabled): Coming soon feature for purchasing books

### 2. Upload Section

#### File Upload Dropzone
- **Functionality**: Drag-and-drop or click to select file
- **Accepted Formats**: `.txt` (text/plain)
- **Buttons**:
  - **Upload book**: Submits the selected file (disabled when no file selected or during upload)
  - **Clear selection**: Clears the selected file
- **Status Messages**:
  - **Success**: "Uploaded! We will process the book and add it to your library shortly." (green banner)
  - **Error**: Displays error message (red banner)
- **File Preview**: Shows "Ready to upload: {filename}" when file is selected

### 3. Search and Filter Section

#### Search Bar
- **Placeholder**: "Search files..."
- **Functionality**: Real-time text search across file names
- **Location**: Left side of the toolbar

#### Sort Dropdown
- **Options**:
  - **Newest first**: Sort by upload date descending (default)
  - **Oldest first**: Sort by upload date ascending
  - **File name A-Z**: Sort alphabetically by filename
  - **Status**: Sort by status (Processing → Failed → Completed)
- **Location**: Right side of the toolbar

### 4. Status Filter Tabs

Visual tabs with counts for each status:
- **All**: Shows all uploaded files
- **Processing**: Files currently being processed
- **Completed**: Successfully processed files
- **Failed**: Files that failed during processing

Each tab displays a count badge showing the number of files in that status.

### 5. File List Section

#### Table Headers (Desktop)
- **File**: Filename with icon
- **Status**: Status badge (Processing/Completed/Failed)
- **Size**: File size in human-readable format (KB, MB, etc.)
- **Uploaded**: Relative time (e.g., "2 hours ago")
- **Actions**: Action buttons

#### File Row Details

**Basic Information:**
- **File Icon**: Document icon with slate background
- **Filename**: Original uploaded filename
- **Size**: Formatted file size (e.g., "2.23 MB")
- **Upload Date**: Relative time display

**Status-Specific Information:**

1. **Processing Status**:
   - Yellow/slate badge with pulsing dot animation
   - Progress bar showing percentage complete (0-100%)
   - Progress percentage text

2. **Completed Status**:
   - Green badge with checkmark icon
   - Book link: "Book created: {Book Title}" (clickable link to `/reader/{bookId}`)
   - Displays the title of the created book

3. **Failed Status**:
   - Red badge with alert icon
   - Error message displayed below filename (truncated with ellipsis)
   - Hover to see full error message

#### File Actions (Buttons)

Available for all files:
- **Download**: Downloads the original uploaded file
  - Icon: Download icon
  - Opens file in new tab via `/api/files/{id}/download`

Available only for failed files:
- **Retry**: Re-initiates processing for a failed file
  - Icon: Refresh icon
  - Changes file status back to "processing" with 0% progress

Always available:
- **Delete**: Removes the file and its data from the system
  - Icon: Trash icon
  - Permanently deletes file metadata and stored file

### 6. Empty States

#### No Uploads State
**Displayed when**: No files have ever been uploaded
- **Title**: "No files uploaded yet"
- **Description**: "Upload a file to start processing it into a book. Completed uploads will link to the created book."
- **Call to Action**: "Use the upload button to begin"

#### No Filtered Results State
**Displayed when**: Files exist but current filter/search returns no results

For search query:
- **Title**: 'No matches for "{query}"'
- **Description**: "Try a different search term, or clear the search."
- **Action Button**: "Clear search"

For status filters:
- **Processing Filter**: "No files are currently processing."
- **Completed Filter**: "No completed uploads yet."
- **Failed Filter**: "No failed uploads."

## User Workflows

### Uploading a New File
1. Navigate to `/uploads`
2. Select a `.txt` file using the dropzone (drag-and-drop or click)
3. Preview shows "Ready to upload: {filename}"
4. Click "Upload book" button
5. File is uploaded and processing begins automatically
6. Success message appears
7. File appears in the list with "Processing" status
8. Progress bar updates as processing continues (handled by worker)
9. Once complete, status changes to "Completed" and book link appears

### Finding a Specific File
1. Use the search bar to filter by filename
2. Or select a status filter tab (All/Processing/Completed/Failed)
3. Or use the sort dropdown to reorder results
4. Combine search, filter, and sort for precise results

### Handling Failed Uploads
1. Failed files show red "Failed" badge
2. Error message explains why processing failed
3. Click "Retry" button to re-process the file
4. File status changes to "Processing" and processing starts again
5. Or click "Delete" to remove the failed upload

### Accessing Processed Books
1. Find completed files (green "Completed" badge)
2. Click on the book link below the filename
3. Redirects to `/reader/{bookId}` to read the book

### Downloading Original Files
1. Locate any file in the list
2. Click the download button (download icon)
3. Original uploaded file opens in new tab for download

### Deleting Files
1. Click the delete button (trash icon) on any file
2. File is immediately removed from the list
3. File metadata and stored file are deleted from the system

## Technical Details

### Data Model
```typescript
type UploadedFile = {
  id: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string; // ISO 8601 format
  status: 'processing' | 'completed' | 'failed';
  progressPct?: number; // 0-100 (optional, for processing files)
  errorMessage?: string; // Only for failed files
  bookId?: string; // Only for completed files
  bookTitle?: string; // Only for completed files
};
```

### Database Collections
- **files**: Stores file metadata, status, and processing progress
- **books**: Created when file processing completes successfully
- Files and books are linked via `fileId` reference

### Server Actions
- `uploadFileAction(formData)`: Handles file upload
- `deleteFileAction(id)`: Handles file deletion
- Both actions revalidate the `/uploads` path to refresh the page

### File Processing Flow
1. User uploads file → Saved to storage
2. File metadata inserted into database with "pending" status
3. Worker picks up pending file and begins processing
4. Worker updates progress percentage periodically
5. On success: Status → "processed", Book created
6. On failure: Status → "failed", Error message stored

## Responsive Design
- **Mobile**: Single column layout, simplified view
- **Desktop**: Grid layout with proper column alignment
- Search and sort controls stack vertically on mobile
- File rows show all information but reformatted for small screens

## Future Enhancements (Currently Disabled)
- Shop page for purchasing pre-processed books (button shows "Soon" badge)
- Additional file format support (currently only `.txt`)
