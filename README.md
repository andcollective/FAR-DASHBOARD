# ZIP Code Assignment Tool

A comprehensive web application for managing sales representative assignments across ZIP code regions. Built with React frontend and Node.js backend, featuring an interactive map interface with color-coded regions and advanced assignment management capabilities.

## 🚀 Features

### Interactive Map Interface
- **Geographic Visualization**: Interactive map showing ZIP code regions across the United States
- **Color-Coded Regions**: Each sales rep is assigned a distinct color for easy visual identification
- **Custom Color System**: Full color customization for each representative with color picker
- **Solo Mode**: Focus on specific representatives by hiding others
- **Dark/Light Mode**: Automatic theme switching based on system preferences

### Assignment Management
- **Individual Assignment**: Click regions to assign specific sales representatives
- **Bulk Assignment**: Multi-select regions for efficient bulk assignments
- **Drawing Tools**: Freehand drawing to select multiple regions at once
- **Real-time Updates**: Immediate visual feedback when assignments change

### Representative Management
- **CRUD Operations**: Add, edit, and delete sales representatives
- **Contact Information**: Store name, email, and phone number for each rep
- **Assignment Tracking**: View which regions are assigned to each representative
- **Reassignment Tools**: Easily reassign regions when deleting representatives

### Draft System
- **Save Drafts**: Save work-in-progress configurations
- **Load Drafts**: Recall previous configurations
- **Publish Changes**: Deploy changes to production with confirmation
- **Revert Functionality**: Rollback to last published configuration

## 🛠️ Technology Stack

### Frontend
- **React 18** with functional components and hooks
- **Leaflet.js** for interactive mapping
- **FontAwesome** for icons
- **Vite** for build tooling and development server

### Backend
- **Node.js** with Express.js
- **SQLite** for data storage
- **RESTful API** for data operations

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd zip-assignment
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up the database**
   ```bash
   cd ../backend
   # The database will be created automatically on first run
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`

3. **Open your browser**
   Navigate to `http://localhost:5173` to access the application

### Production Build

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Serve the production build**
   ```bash
   npm run preview
   ```

## 📁 Project Structure

```
zip-assignment/
├── backend/                 # Node.js/Express backend
│   ├── server.js           # Main server file
│   ├── database.js         # Database setup and operations
│   └── package.json        # Backend dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── App.css         # Application styles
│   │   └── main.jsx        # Application entry point
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
├── data/                   # Data files (CSV imports)
├── drafts/                 # Draft storage
└── README.md              # This file
```

## 🎯 Usage Guide

### Basic Operations

1. **Viewing the Map**
   - The map loads with all ZIP code regions visible
   - Each region is colored based on its assigned sales representative
   - Unassigned regions appear in a default color

2. **Assigning Representatives**
   - Click on any region to open the assignment panel
   - Select a sales representative from the dropdown
   - Click "Save" to assign the region

3. **Bulk Assignments**
   - Switch to "Edit" mode using the drawing tools
   - Click multiple regions or use the drawing tool to select areas
   - Choose a representative and assign to all selected regions

4. **Managing Representatives**
   - Use the legend panel to add, edit, or delete representatives
   - Customize colors for each representative
   - Use solo mode to focus on specific representatives

### Advanced Features

1. **Color Customization**
   - Click on any color swatch in the legend to open the color picker
   - Choose from predefined colors or use the custom color picker
   - Colors update immediately on the map

2. **Draft Management**
   - Save your current work as a draft
   - Load previous drafts to continue work
   - Publish changes when ready to deploy

3. **Solo Mode**
   - Click the circle icon next to any representative to solo them
   - Only their assigned regions will be visible on the map
   - Click again to return to showing all representatives

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
NODE_ENV=development
```

### Database Configuration

The application uses SQLite by default. Database files are created automatically in the backend directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the console for error messages
2. Ensure both backend and frontend servers are running
3. Verify database files are accessible
4. Check that all dependencies are installed correctly

## 🔄 Updates

To update the application:

1. Pull the latest changes: `git pull origin main`
2. Update dependencies: `npm install` (in both backend and frontend)
3. Restart the servers

---

**Note**: This application is designed for internal use and includes features for managing sales representative assignments across geographic regions. Ensure proper data handling and access controls are in place for production use. 