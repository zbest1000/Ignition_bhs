# Ignition Layout Studio

Web-based Drawing-to-Ignition HMI Generator for transforming engineering drawings into fully functional Ignition Perspective and Vision HMI screens.

## 🎯 Overview

Ignition Layout Studio is a powerful web application that transforms engineering drawings for Baggage Handling Systems (BHS) and other industrial layouts into scalable Ignition HMI screens. It supports component detection, manual classification, SVG generation, and template export, all within a modern web UI.

## ✨ Features

- **Multi-Format File Support**: Import DWG/DXF, PDF, PNG, TIFF, JPEG, XLSX/CSV files
- **OCR Processing**: Extract component labels and equipment IDs using PaddleOCR
- **Interactive Canvas Editor**: 
  - Drag-and-drop component manipulation
  - Multi-select with lasso tool
  - Zoom/pan navigation
  - Grid snapping
  - Layer management
- **Component Library**: Pre-built components for conveyors, motors, diverters, EDS machines, and more
- **Template Builder**: Create reusable global templates with dynamic parameters
- **Export Options**:
  - SVG layouts with accurate scaling
  - Ignition Perspective JSON views
  - Ignition Vision XML windows
  - Complete project packages with metadata

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/ignition-layout-studio.git
cd ignition-layout-studio
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Running in Development

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend:
```bash
cd frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

### Running with Docker

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. Access the application at `http://localhost:3000`

## 📖 Usage

### Creating a Project

1. Click "New Project" on the home screen
2. Enter a project name and optional description
3. Click "Create" to start working

### Uploading Files

1. Open a project
2. Click on the Files tab in the sidebar
3. Upload drawings in supported formats (DWG, DXF, PDF, images, CSV/XLSX)
4. For images and PDFs, click the OCR button to extract text and components

### Working with Components

1. **Select Tool**: Click and drag to select components
2. **Pan Tool**: Navigate around the canvas
3. **Grid Toggle**: Enable/disable grid display and snapping
4. **Labels**: Show/hide component labels

### Creating Templates

1. Select one or more components
2. Right-click and choose "Create Template"
3. Define parameters like equipment ID, tag bindings, and animations
4. Save the template for reuse

### Exporting

1. Click the "Export" button in the toolbar
2. Choose export options:
   - SVG Layout
   - Perspective Views
   - Vision Windows
   - Templates
   - Metadata
3. Download the generated package

## 🏗️ Architecture

### Backend (Node.js/Express)
- RESTful API for project management
- WebSocket support for real-time collaboration
- File processing and storage
- Export generation

### Frontend (React/TypeScript)
- React with TypeScript for type safety
- Konva.js for canvas rendering
- Ant Design for UI components
- Socket.io for real-time updates

### Data Flow
```
Drawing Files → OCR Processing → Component Detection → 
Manual Classification → Template Assignment → Export Generation
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
MAX_FILE_SIZE=100MB
PADDLE_OCR_MODEL_PATH=./models/paddleocr
```

### Project Structure
```
ignition-layout-studio/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── models/
│   │   ├── services/
│   │   └── utils/
│   ├── uploads/
│   ├── exports/
│   └── projects/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   └── public/
├── docker/
├── docs/
└── README.md
```

## 📝 API Documentation

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Components
- `GET /api/components/:projectId` - Get project components
- `POST /api/components/:projectId` - Create component
- `PUT /api/components/:projectId/:componentId` - Update component
- `DELETE /api/components/:projectId/:componentId` - Delete component

### Export
- `GET /api/export/:projectId/svg` - Export as SVG
- `POST /api/export/:projectId/perspective` - Export Perspective view
- `POST /api/export/:projectId/vision` - Export Vision window
- `POST /api/export/:projectId/package` - Export complete package

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- PaddleOCR for text extraction capabilities
- Konva.js for canvas rendering
- Ant Design for UI components
- The Ignition SCADA platform by Inductive Automation

## ⚠️ Persistent Storage Requirements

**Important:** All project data and uploaded files are stored on disk in the `projects/` and `uploads/` directories. To avoid data loss:

- Ensure these directories are mapped to persistent storage (e.g., Docker volumes, cloud storage) in production or containerized deployments.
- If running locally, do not delete or overwrite these folders unless you intend to remove all project data.
- On Docker, use volume mounts:
  ```
  docker-compose.yml
  volumes:
    - ./ignition-layout-studio/projects:/app/projects
    - ./ignition-layout-studio/uploads:/app/uploads
  ```
- Back up these directories regularly if your data is important.

If these folders are deleted or not persisted, all project and file data will be lost on server restart.