import React, { useEffect, useRef, useState, Component } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './App.css';
import L from 'leaflet';
import 'leaflet-draw';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt, faTrash, faSave, faFolderOpen, faRotateLeft, faEye, faEyeSlash, faPlus, faChevronUp, faDrawPolygon, faMousePointer, faSquare, faEdit, faTrashAlt, faPaintBrush, faCircle } from '@fortawesome/free-solid-svg-icons';

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#721c24', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px',
          margin: '20px'
        }}>
          <h3>Something went wrong with the map component.</h3>
          <p>Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Fix Leaflet Draw icon issues
L.drawLocal.draw.toolbar.buttons.polygon = 'Draw a polygon';
L.drawLocal.draw.toolbar.buttons.rectangle = 'Draw a rectangle';
L.drawLocal.draw.toolbar.undo.text = 'Delete the last point drawn';
L.drawLocal.draw.handlers.polygon.tooltip.start = 'Click to start drawing shape.';
L.drawLocal.draw.handlers.polygon.tooltip.cont = 'Click to continue drawing shape.';
L.drawLocal.draw.handlers.polygon.tooltip.end = 'Click first point to close this shape.';
L.drawLocal.draw.handlers.rectangle.tooltip.start = 'Click and drag to draw rectangle.';
L.drawLocal.draw.handlers.rectangle.tooltip.end = 'Release mouse to finish drawing.';
L.drawLocal.edit.toolbar.buttons.edit = 'Edit layers';
L.drawLocal.edit.toolbar.buttons.editDisabled = 'No layers to edit';
L.drawLocal.edit.toolbar.buttons.remove = 'Delete layers';
L.drawLocal.edit.toolbar.buttons.removeDisabled = 'No layers to delete';
L.drawLocal.edit.handlers.edit.tooltip.text = 'Drag handles, or marker to edit feature.';
L.drawLocal.edit.handlers.edit.tooltip.subtext = 'Click cancel to undo changes.';
L.drawLocal.edit.handlers.remove.tooltip.text = 'Click on a feature to remove';



const ZIP3_GEOJSON_URL = '/usa_zip3_codes_geo_optimized.geojson';
const API_URL = 'http://localhost:3001/api/zip3';

function MapClickHandler({ drawingMode, selected, setSelected, selectedRegions, setSelectedRegions }) {
  const map = useMap();
  
  React.useEffect(() => {
    const handleMapClick = (e) => {
      // Only handle map clicks in inspect mode when there's a selection
      if (drawingMode === 'inspect' && selected) {
        // Check if the click was on a region or on empty space
        // Look for any GeoJSON layer in the clicked elements
        const clickedElement = e.originalEvent.target;
        const isRegionClick = clickedElement && (
          clickedElement.classList.contains('leaflet-interactive') ||
          clickedElement.closest('.leaflet-interactive')
        );
        
        if (!isRegionClick) {
          // Click was on empty space, clear the selection
          setSelected(null);
        }
      }
    };

    const handleMapDragStart = (e) => {
      // Hide all tooltips when map dragging starts
      const tooltips = document.querySelectorAll('.leaflet-tooltip');
      tooltips.forEach(tooltip => {
        if (tooltip.style.display !== 'none') {
          tooltip.style.display = 'none';
        }
      });
    };

    map.on('click', handleMapClick);
    map.on('dragstart', handleMapDragStart);
    
    return () => {
      map.off('click', handleMapClick);
      map.off('dragstart', handleMapDragStart);
    };
  }, [map, drawingMode, selected, setSelected, selectedRegions, setSelectedRegions]);
  
  return null;
}

function FitBounds({ geojson, selectedFeature, hasZoomedInitially, selectedRegions, drawingMode }) {
  const map = useMap();
  const hasMultipleRegionsSelected = useRef(false);
  
  // Update the ref when selectedRegions changes
  React.useEffect(() => {
    hasMultipleRegionsSelected.current = selectedRegions && selectedRegions.length > 0;
  }, [selectedRegions]);
  
  React.useEffect(() => {
    console.log('FitBounds effect triggered:', { 
      hasGeojson: !!geojson, 
      hasSelectedFeature: !!selectedFeature, 
      selectedFeature: selectedFeature,
      hasZoomedInitially: hasZoomedInitially.current,
      hasMultipleRegionsSelected: hasMultipleRegionsSelected.current
    });
    
    try {
      // Don't zoom if in edit mode (regardless of whether regions are selected)
      if (drawingMode === 'edit') {
        console.log('Skipping zoom due to edit mode');
        return;
      }
      
      if (selectedFeature && selectedFeature.geometry) {
        console.log('Zooming to selected feature');
        // Zoom to selected feature
        const leafletGeoJson = L.geoJSON(selectedFeature);
        const bounds = leafletGeoJson.getBounds();
        console.log('Selected feature bounds:', bounds);
        if (bounds && bounds.isValid && bounds.isValid() && bounds.getNorthEast() && bounds.getSouthWest()) {
          map.fitBounds(bounds, { padding: [70, 70] });
        } else {
          console.warn('Invalid bounds for selected feature');
        }
      } else if (geojson && !hasZoomedInitially.current) {
        console.log('Setting initial view to continental US');
        // Set a specific view that focuses on continental US only, ignoring Alaska and Hawaii
        // This prevents the globe view issue while keeping all data available
        const continentalUSBounds = L.latLngBounds(
          L.latLng(30, -135), // Southwest: Moved more left and up
          L.latLng(57, -75)   // Northeast: Moved more left and up
        );
        map.fitBounds(continentalUSBounds, { padding: [20, 20] });
        hasZoomedInitially.current = true;
      }
    } catch (error) {
      console.warn('Error in FitBounds component:', error);
      // Set a default view if bounds calculation fails
      if (!hasZoomedInitially.current) {
        console.log('Setting default view due to error');
        map.setView([39.5, -98.35], 4);
        hasZoomedInitially.current = true;
      }
    }
  }, [geojson, selectedFeature, map, hasZoomedInitially, selectedRegions, drawingMode]);
  
  return null;
}

function DrawingControls({ drawingMode, setDrawingMode, selectedRegions, setSelectedRegions, zip3Geojson, reps, assignRep, drawingLayerRef, setSelected }) {
  const map = useMap();
  const drawControlRef = useRef();
  const currentDrawControl = useRef(null);
  const currentEditControl = useRef(null);
  const currentDeleteControl = useRef(null);

  React.useEffect(() => {
    if (!map || !zip3Geojson) return;

    // Create drawing layer
    const drawnItems = new L.FeatureGroup();
    drawingLayerRef.current = drawnItems;
    map.addLayer(drawnItems);

    // Create custom draw control
    const CustomDrawControl = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      
      onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar');
        
        // Freehand drawing button
        const freehandBtn = L.DomUtil.create('a', 'leaflet-draw-draw-freehand', container);
        freehandBtn.href = '#';
        freehandBtn.title = 'Freehand drawing';
        freehandBtn.innerHTML = '<i class="fas fa-paint-brush"></i>';
        L.DomEvent.on(freehandBtn, 'click', L.DomEvent.stopPropagation)
          .on(freehandBtn, 'click', L.DomEvent.preventDefault)
          .on(freehandBtn, 'click', () => {
            // Disable any existing controls
            if (currentDrawControl.current) {
              currentDrawControl.current.disable();
            }
            if (currentEditControl.current) {
              currentEditControl.current.disable();
            }
            if (currentDeleteControl.current) {
              currentDeleteControl.current.disable();
            }
            
            // Create a simple freehand drawing mode
            // Create a simple freehand drawing mode
            let isDrawing = false;
            let currentPath = null;
            
            const startDrawing = (e) => {
              isDrawing = true;
              const latlng = e.latlng;
              currentPath = L.polyline([latlng], {
                color: '#bada55',
                weight: 3,
                fill: false
              });
              drawnItems.addLayer(currentPath);
            };
            
            const draw = (e) => {
              if (isDrawing && currentPath) {
                currentPath.addLatLng(e.latlng);
              }
            };
            
            const stopDrawing = () => {
              if (isDrawing && currentPath) {
                isDrawing = false;
                // Convert the path to a polygon and find intersecting regions
                const pathBounds = currentPath.getBounds();
                const intersectingRegions = zip3Geojson.features.filter(feature => {
                  if (!feature.geometry) return false;
                  const featureLayer = L.geoJSON(feature);
                  return featureLayer.getBounds().intersects(pathBounds);
                });
                
                const selectedZip3s = intersectingRegions.map(f => 
                  String(f.properties.Postal).padStart(3, '0').trim()
                );
                
                setSelectedRegions(prev => {
                  const newSelection = [...new Set([...prev, ...selectedZip3s])];
                  return newSelection;
                });
                
                // Remove the temporary path and add a permanent polygon
                drawnItems.removeLayer(currentPath);
                const polygon = L.polygon(currentPath.getLatLngs(), {
                  color: '#bada55',
                  weight: 2,
                  fillOpacity: 0.3
                });
                drawnItems.addLayer(polygon);
                
                // Auto-exit drawing mode after successful drawing
                if (map._freehandEventListeners) {
                  map._freehandEventListeners.cleanup();
                }
              }
            };
            
            // Show cancel button and highlight active button
            cancelBtn.style.display = 'block';
            freehandBtn.classList.add('active');
            
            // Add cursor class to map
            map.getContainer().classList.add('drawing-freehand');
            
            // Disable map dragging during freehand drawing
            const originalDragging = map.dragging.enabled();
            map.dragging.disable();
            
            // Store event listener references for cleanup
            map._freehandEventListeners = {
              startDrawing,
              draw,
              stopDrawing,
              cleanup: () => {
                map.off('mousedown', startDrawing);
                map.off('mousemove', draw);
                map.off('mouseup', stopDrawing);
                map.off('click', map._freehandEventListeners.cleanup);
                // Re-enable map dragging
                if (originalDragging) {
                  map.dragging.enable();
                }
                // Hide cancel button and remove active states
                cancelBtn.style.display = 'none';
                freehandBtn.classList.remove('active');
                // Remove cursor classes from map
                map.getContainer().classList.remove('drawing-freehand');
                // Clear the reference
                map._freehandEventListeners = null;
              }
            };
            
            // Add event listeners
            map.on('mousedown', startDrawing);
            map.on('mousemove', draw);
            map.on('mouseup', stopDrawing);
            
            // Clean up after drawing
            map.once('click', map._freehandEventListeners.cleanup);
          });
        
        // Cancel/Clear button - only show when a drawing mode is active
        const cancelBtn = L.DomUtil.create('a', 'leaflet-draw-cancel', container);
        cancelBtn.href = '#';
        cancelBtn.title = 'Cancel drawing';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
        cancelBtn.style.display = 'none'; // Start hidden
        L.DomEvent.on(cancelBtn, 'click', L.DomEvent.stopPropagation)
          .on(cancelBtn, 'click', L.DomEvent.preventDefault)
          .on(cancelBtn, 'click', () => {
            // Disable any existing controls
            if (currentDrawControl.current) {
              currentDrawControl.current.disable();
              currentDrawControl.current = null;
            }
            if (currentEditControl.current) {
              currentEditControl.current.disable();
              currentEditControl.current = null;
            }
            if (currentDeleteControl.current) {
              currentDeleteControl.current.disable();
              currentDeleteControl.current = null;
            }
            
            // Clean up freehand drawing event listeners
            if (map._freehandEventListeners) {
              map.off('mousedown', map._freehandEventListeners.startDrawing);
              map.off('mousemove', map._freehandEventListeners.draw);
              map.off('mouseup', map._freehandEventListeners.stopDrawing);
              map.off('click', map._freehandEventListeners.cleanup);
              map._freehandEventListeners = null;
            }
            
            // Re-enable map dragging if it was disabled
            if (map.dragging && !map.dragging.enabled()) {
              map.dragging.enable();
            }
            
            // Hide the cancel button and remove active states
            cancelBtn.style.display = 'none';
            polygonBtn.classList.remove('active');
            freehandBtn.classList.remove('active');
            
            // Remove cursor classes from map
            map.getContainer().classList.remove('drawing-polygon', 'drawing-freehand');
          });
        

        

        
        return container;
      }
    });

    const drawControl = new CustomDrawControl();

    drawControlRef.current = drawControl;
    
    // Only show draw control when in draw mode
    if (drawingMode === 'draw') {
      map.addControl(drawControl);
    }

    // Handle draw events
    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = event.layer;
      drawnItems.addLayer(layer);

      // Find intersecting zip3 regions
      const drawnBounds = layer.getBounds();
      const intersectingRegions = zip3Geojson.features.filter(feature => {
        if (!feature.geometry) return false;
        const featureLayer = L.geoJSON(feature);
        return featureLayer.getBounds().intersects(drawnBounds);
      });

      const selectedZip3s = intersectingRegions.map(f => 
        String(f.properties.Postal).padStart(3, '0').trim()
      );

      setSelectedRegions(prev => {
        const newSelection = [...new Set([...prev, ...selectedZip3s])];
        return newSelection;
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      setSelectedRegions([]);
    });

    // Store the drawnItems reference for the custom control
    drawControl.drawnItems = drawnItems;

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      if (drawingLayerRef.current) {
        map.removeLayer(drawingLayerRef.current);
      }
    };
  }, [map, zip3Geojson, setSelectedRegions]);

  // Handle drawing mode changes
  React.useEffect(() => {
    if (!map || !drawControlRef.current) return;

    if (drawingMode === 'edit') {
      map.addControl(drawControlRef.current);
      // Clear single selection when switching to edit mode
      setSelected(null);
    } else {
      // Cancel any active drawing mode when switching to inspect mode
      // Disable any existing controls
      if (currentDrawControl.current) {
        currentDrawControl.current.disable();
        currentDrawControl.current = null;
      }
      if (currentEditControl.current) {
        currentEditControl.current.disable();
        currentEditControl.current = null;
      }
      if (currentDeleteControl.current) {
        currentDeleteControl.current.disable();
        currentDeleteControl.current = null;
      }
      
      // Clean up freehand drawing event listeners
      if (map._freehandEventListeners) {
        map.off('mousedown', map._freehandEventListeners.startDrawing);
        map.off('mousemove', map._freehandEventListeners.draw);
        map.off('mouseup', map._freehandEventListeners.stopDrawing);
        map.off('click', map._freehandEventListeners.cleanup);
        map._freehandEventListeners = null;
      }
      
      // Re-enable map dragging if it was disabled
      if (map.dragging && !map.dragging.enabled()) {
        map.dragging.enable();
      }
      
      // Remove cursor classes from map
      map.getContainer().classList.remove('drawing-polygon', 'drawing-freehand');
      
      map.removeControl(drawControlRef.current);
      // Clear selection and drawn shapes when switching to inspect mode
      setSelectedRegions([]);
      if (drawingLayerRef.current) {
        drawingLayerRef.current.clearLayers();
      }
    }
  }, [drawingMode, map, setSelectedRegions]);

  return null;
}

function App() {
  const [zip3Geojson, setZip3Geojson] = useState(null);
  const [isLoadingGeoJSON, setIsLoadingGeoJSON] = useState(true);
  const [selected, setSelected] = useState(null);
  const geoJsonLayer = useRef();
  const hasZoomedInitially = useRef(false);
  const [selectedRep, setSelectedRep] = useState('');
  const [selectedRepForMultiple, setSelectedRepForMultiple] = useState('');
  const [activeTab, setActiveTab] = useState('regions');
  const [repsList, setRepsList] = useState([]);
  const [newRep, setNewRep] = useState({ Name: '', Email: '', 'Phone Number': '' });
  const [repError, setRepError] = useState('');
  const [showAddRep, setShowAddRep] = useState(false);
  const [editRep, setEditRep] = useState(null); // null or rep object
  const [deleteModal, setDeleteModal] = useState({ open: false, rep: null, zip3s: [], newRep: '' });

  // Draft management state
  const [drafts, setDrafts] = useState([]); // list of {id, name, timestamp}
  const [currentDraftId, setCurrentDraftId] = useState(null); // id of loaded draft
  const [currentDraftName, setCurrentDraftName] = useState('Unsaved changes');
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState('');
  // Working draft state
  const [workingZip3, setWorkingZip3] = useState([]); // [{Zipcode, Sales_Rep}]
  const [workingReps, setWorkingReps] = useState([]); // [{Name, Email, Phone Number}]
  const [showDraftDropdown, setShowDraftDropdown] = useState(false);
  const [lastPublishedDraft, setLastPublishedDraft] = useState(null); // {zip3Assignments, repsList}
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [pendingPublishType, setPendingPublishType] = useState(null); // 'draft' or 'direct'
  const [showLegend, setShowLegend] = useState(false); // Start collapsed
  const [soloRep, setSoloRep] = useState(null); // null = show all
  
  // Drawing tools state
  const [drawingMode, setDrawingMode] = useState('inspect'); // 'inspect' or 'edit'
  const [selectedRegions, setSelectedRegions] = useState([]); // Array of zip3 codes
  const [drawingLayer, setDrawingLayer] = useState(null);
  const [drawControl, setDrawControl] = useState(null);
  const drawingLayerRef = useRef(); // Add ref to track drawing layer

  // Color customization state
  const [customColors, setCustomColors] = useState({}); // {repName: color}
  const [showColorPicker, setShowColorPicker] = useState(null); // repName or null
  const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });

  // Helper: get rep map for region assignment (from workingZip3)
  const reps = Object.fromEntries(workingZip3.map(r => [String(r.Zipcode).padStart(3, '0').trim(), r.Sales_Rep]));

  // Log state for backend tasks
  const [logMessages, setLogMessages] = useState([]);
  const addLog = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setLogMessages(logs => [...logs, { id, msg, type, time: new Date() }]);
    setTimeout(() => {
      setLogMessages(logs => logs.filter(l => l.id !== id));
    }, 5000);
  };

  // Update selectedRep when selected or reps change
  useEffect(() => {
    if (selected) {
      setSelectedRep(reps[String(selected).padStart(3, '0').trim()] || '');
    } else {
      setSelectedRep('');
    }
  }, [selected]); // Only run when 'selected' changes

  // Load 3-digit GeoJSON with lazy loading
  useEffect(() => {
    console.log('Starting to load GeoJSON from:', ZIP3_GEOJSON_URL);
    setIsLoadingGeoJSON(true);
    
    // Use a timeout to prevent blocking the UI
    const loadGeoJSON = async () => {
      try {
        const res = await fetch(ZIP3_GEOJSON_URL);
        console.log('GeoJSON fetch response status:', res.status);
        if (!res.ok) {
          throw new Error(`Failed to load GeoJSON: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('GeoJSON data received, validating...');
        
        // Validate and filter out features with null geometry
        if (!data || !data.features || !Array.isArray(data.features)) {
          throw new Error('Invalid GeoJSON structure');
        }
        
        console.log(`Original features count: ${data.features.length}`);
        
        // Zipcodes to exclude from display
        const excludedZipcodes = ['006', '007', '008', '009', '969'];
        
        const filtered = {
          ...data,
          features: data.features.filter(f => {
            const isValid = f.geometry && f.geometry.coordinates && f.properties && f.properties.Postal;
            if (!isValid) {
              console.warn('Filtering out invalid feature:', f);
              return false;
            }
            
            // Check if zipcode should be excluded
            const zip3 = String(f.properties.Postal).padStart(3, '0').trim();
            if (excludedZipcodes.includes(zip3)) {
              console.log(`Excluding zipcode: ${zip3}`);
              return false;
            }
            
            // Filter out features that span across the 180° meridian (Alaska Aleutian Islands issue)
            const coordinates = f.geometry.coordinates;
            if (f.geometry.type === 'Polygon') {
              // Check if any polygon ring has coordinates that span too far
              for (const ring of coordinates) {
                const lons = ring.map(coord => coord[0]);
                const lonRange = Math.max(...lons) - Math.min(...lons);
                if (lonRange > 180) {
                  console.log(`Excluding feature with excessive longitude range: ${zip3} (range: ${lonRange}°)`);
                  return false;
                }
              }
            } else if (f.geometry.type === 'MultiPolygon') {
              // Check each polygon in the multipolygon
              for (const polygon of coordinates) {
                for (const ring of polygon) {
                  const lons = ring.map(coord => coord[0]);
                  const lonRange = Math.max(...lons) - Math.min(...lons);
                  if (lonRange > 180) {
                    console.log(`Excluding feature with excessive longitude range: ${zip3} (range: ${lonRange}°)`);
                    return false;
                  }
                }
              }
            }
            
            return true;
          })
        };
        
        console.log(`Filtered features count: ${filtered.features.length}`);
        
        if (filtered.features.length === 0) {
          throw new Error('No valid features found in GeoJSON');
        }
        
        console.log(`Loaded ${filtered.features.length} valid GeoJSON features`);
        setZip3Geojson(filtered);
        setIsLoadingGeoJSON(false);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setZip3Geojson(null);
        setIsLoadingGeoJSON(false);
      }
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => loadGeoJSON());
    } else {
      setTimeout(loadGeoJSON, 0);
    }
  }, []);

  // Load reps
  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        console.log('API /api/zip3 response sample:', data.slice ? data.slice(0, 10) : data);
        const repMap = {};
        data.forEach((row) => {
          // Remove apostrophe, pad to 3 digits, and trim
          const zip3 = String(row.Zipcode).replace(/^'/, '').padStart(3, '0').trim();
          repMap[zip3] = row.Sales_Rep;
        });
        console.log('Full repMap sample:', Object.entries(repMap).slice(0, 20));
        // setReps(repMap); // REMOVE THIS LINE
      });
  }, []);

  // Load drafts list
  useEffect(() => {
    fetch('http://localhost:3001/api/drafts')
      .then(res => res.json())
      .then(setDrafts);
  }, []);

  // Load live data as initial working draft
  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setWorkingZip3(data));
    fetch('http://localhost:3001/api/reps')
      .then(res => res.json())
      .then(data => setWorkingReps(data));
  }, []);

  // Fetch reps for Reps tab
  useEffect(() => {
    if (activeTab === 'reps') {
      fetch('http://localhost:3001/api/reps')
        .then(res => res.json())
        .then(data => setRepsList(data));
    }
  }, [activeTab]);

  // Add or edit rep
  const handleAddRep = async (e) => {
    e.preventDefault();
    setRepError('');
    if (!newRep.Name || !newRep.Email || !newRep['Phone Number']) {
      setRepError('All fields are required.');
      return;
    }
    if (editRep) {
      // Edit mode
      setWorkingReps(prev => prev.map(r => r.Name === editRep.Name ? { ...r, Email: newRep.Email, 'Phone Number': newRep['Phone Number'] } : r));
      setRepsList(prev => prev.map(r => r.Name === editRep.Name ? { ...r, Email: newRep.Email, 'Phone Number': newRep['Phone Number'] } : r));
      handleCloseAddRep();
    } else {
      // Add mode
      setWorkingReps(prev => [...prev, newRep]);
      setRepsList(prev => [...prev, newRep]);
      setNewRep({ Name: '', Email: '', 'Phone Number': '' });
      handleCloseAddRep();
    }
  };

  // Open modal for add or edit
  const handleOpenAddRep = () => { setShowAddRep(true); setEditRep(null); };
  const handleOpenEditRep = (rep) => { setShowAddRep(true); setEditRep(rep); setNewRep(rep); };
  const handleCloseAddRep = () => { setShowAddRep(false); setEditRep(null); setRepError(''); setNewRep({ Name: '', Email: '', 'Phone Number': '' }); };

  // Save as new draft
  const handleSaveDraft = async () => {
    if (!saveDraftName) return;
    addLog('Saving draft...');
    const res = await fetch('http://localhost:3001/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: saveDraftName,
        zip3Assignments: workingZip3,
        repsList: workingReps,
      }),
    });
    if (res.ok) {
      setShowSaveDraftModal(false);
      setSaveDraftName('');
      addLog('Draft saved.');
      // Refresh drafts list and exclude 'Direct Publish' drafts
      fetch('http://localhost:3001/api/drafts')
        .then(res => res.json())
        .then(list => {
          console.log('Drafts list after save:', list);
          setDrafts(list.filter(d => d.name !== 'Direct Publish'));
        });
    } else {
      addLog('Error saving draft.', 'error');
    }
  };

  // Load a draft
  const handleLoadDraft = async (id) => {
    addLog('Loading draft...');
    const res = await fetch(`http://localhost:3001/api/drafts/${id}`);
    if (res.ok) {
      const draft = await res.json();
      setWorkingZip3(draft.zip3Assignments);
      setWorkingReps(draft.repsList);
      setCurrentDraftId(id);
      setCurrentDraftName(draft.name);
      addLog('Draft loaded.');
      // Do NOT reload backend data here
    } else {
      addLog('Error loading draft.', 'error');
    }
  };

  // Delete a draft
  const handleDeleteDraft = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    addLog('Deleting draft...');
    const res = await fetch(`http://localhost:3001/api/drafts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDrafts(drafts => drafts.filter(d => d.id !== id));
      if (currentDraftId === id) {
        setCurrentDraftId(null);
        setCurrentDraftName('Unsaved changes');
      }
      addLog('Draft deleted.');
    } else {
      addLog('Error deleting draft.', 'error');
    }
  };

  // Publish handler: always confirm
  const handlePublish = () => {
    setShowPublishConfirmModal(true);
    setPendingPublishType(currentDraftId ? 'draft' : 'direct');
  };

  const handlePhoneInputChange = (e) => {
    const input = e.target.value.replace(/\D/g, '').substring(0, 10);
    let formatted = '';
    if (input.length > 0) {
      formatted = input.substring(0, 3);
    }
    if (input.length > 3) {
      formatted += '-' + input.substring(3, 6);
    }
    if (input.length > 6) {
      formatted += '-' + input.substring(6, 10);
    }
    setNewRep(r => ({ ...r, 'Phone Number': formatted }));
  };

  // Confirm publish (from modal)
  const handleConfirmPublish = async () => {
    setShowPublishConfirmModal(false);
    if (pendingPublishType === 'draft' && currentDraftId) {
      addLog('Publishing draft...');
      const res = await fetch(`http://localhost:3001/api/drafts/${currentDraftId}/publish`, { method: 'POST' });
      if (res.ok) {
        addLog('Draft published.');
        setLastPublishedDraft({ zip3Assignments: [...workingZip3], repsList: [...workingReps] });
        // No alert, no reload
        // Optionally, refetch drafts or working state if needed
        return;
      } else {
        addLog('Error publishing draft.', 'error');
        return;
      }
    } else {
      // Direct publish: create a temp draft and publish it
      addLog('Publishing changes...');
      const res = await fetch('http://localhost:3001/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Direct Publish',
          zip3Assignments: workingZip3,
          repsList: workingReps,
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        const pubRes = await fetch(`http://localhost:3001/api/drafts/${id}/publish`, { method: 'POST' });
        if (pubRes.ok) {
          addLog('Changes published.');
          setLastPublishedDraft({ zip3Assignments: [...workingZip3], repsList: [...workingReps] });
          // No alert, no reload
          // Optionally, refetch drafts or working state if needed
          return;
        } else {
          addLog('Error publishing changes.', 'error');
          return;
        }
      } else {
        addLog('Error saving temporary draft.', 'error');
        return;
      }
    }
    // Always reload backend data after publish
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        setWorkingZip3(data);
      });
    fetch('http://localhost:3001/api/reps')
      .then(res => res.json())
      .then(data => {
        setWorkingReps(data);
        setRepsList(data);
      });
  };

  // On load, set lastPublishedDraft if this draft is published (simulate by setting on first load)
  useEffect(() => {
    if (!lastPublishedDraft && workingZip3.length && workingReps.length) {
      setLastPublishedDraft({ zip3Assignments: [...workingZip3], repsList: [...workingReps] });
    }
  }, [workingZip3, workingReps, lastPublishedDraft]);

  // Use workingReps for sales rep dropdown
  const salesRepNames = workingReps.map(r => r.Name).sort();

  // Color palette for reps - vibrant and saturated for better visibility
  const repColors = [
    '#FF1744', // Bright red
    '#00BCD4', // Cyan
    '#3F51B5', // Indigo
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#2196F3', // Blue
    '#F4D03F', // Muted yellow
    '#E91E63', // Pink
    '#009688', // Teal
    '#FF5722', // Deep orange
    '#673AB7', // Deep purple
    '#8BC34A', // Light green
    '#03A9F4', // Light blue
    '#FFC107', // Amber
    '#795548', // Brown
    '#607D8B', // Blue grey
    '#F44336', // Red
    '#00ACC1', // Light cyan
    '#5E35B1', // Deep purple
    '#43A047', // Dark green
    '#1E88E5', // Dark blue
    '#FFB300', // Dark amber
    '#D81B60', // Dark pink
    '#00897B', // Dark teal
    '#FF6F00', // Dark orange
    '#3949AB', // Dark indigo
    '#7CB342', // Light green
    '#29B6F6', // Light blue
    '#FFD54F', // Light amber
    '#AB47BC', // Light purple
    '#26A69A', // Light teal
    '#42A5F5'  // Light blue
  ];
  
  // Map rep name to color with maximum separation
  const repNameToColor = {};
  
  // Pre-define highly distinct color indices for maximum separation (shuffled again)
  const distinctColorIndices = [
    7,   // Yellow
    2,   // Indigo
    9,   // Teal
    0,   // Bright red
    5,   // Purple
    1,   // Cyan
    3,   // Green
    6,   // Blue
    4,   // Orange
    8,   // Pink
    13,  // Light blue
    10,  // Deep orange
    11,  // Deep purple
    12,  // Light green
    14,  // Amber
    15,  // Brown
    16,  // Blue grey
    17,  // Red (different shade)
    18,  // Light cyan
    19,  // Deep purple (different shade)
    20,  // Dark green
    21,  // Dark blue
    22,  // Dark amber
    23,  // Dark pink
    24,  // Dark teal
    25,  // Dark orange
    26,  // Dark indigo
    27,  // Light green (different shade)
    28,  // Light blue (different shade)
    29,  // Light amber
    30,  // Light purple
    31   // Light teal
  ];
  
  // Function to get color for a rep (custom or default)
  const getRepColor = (repName) => {
    // Return custom color if set
    if (customColors[repName]) {
      return customColors[repName];
    }
    
    // Return default color from palette
    const repIndex = workingReps.findIndex(rep => rep.Name === repName);
    if (repIndex !== -1) {
      const colorIndex = distinctColorIndices[repIndex % distinctColorIndices.length];
      return repColors[colorIndex];
    }
    
    // Fallback color
    return isDarkMode ? '#26c6da' : 'blue';
  };
  
  // Assign default colors to all reps
  workingReps.forEach((rep, idx) => {
    const colorIndex = distinctColorIndices[idx % distinctColorIndices.length];
    repNameToColor[rep.Name] = getRepColor(rep.Name);
  });
  

  
  // Update custom color for a rep
  const updateRepColor = (repName, color) => {
    setCustomColors(prev => ({
      ...prev,
      [repName]: color
    }));
    setShowColorPicker(null); // Close color picker
  };
  
  


  // Style for 3-digit polygons
  const style3 = (feature) => {
    try {
      if (!feature || !feature.properties || !feature.properties.Postal) {
        return { fillOpacity: 0, opacity: 0 };
      }
      
      const zip3 = String(feature.properties.Postal).padStart(3, '0').trim();
      const rep = reps[zip3];
      const color = rep ? getRepColor(rep) : (isDarkMode ? '#26c6da' : 'blue');
      const isSoloed = soloRep && rep !== soloRep;
      const isSelected = selectedRegions.includes(zip3);
      
      if (soloRep && rep !== soloRep) {
        // Hide non-soloed reps' regions
        return {
          color: 'transparent',
          weight: 0,
          fillOpacity: 0,
          opacity: 0,
          fillColor: 'transparent',
          pointerEvents: 'none',
        };
      }
      
      // Multi-selected state
      if (isSelected) {
        return {
          color: '#ff6b35',
          weight: 3,
          fillOpacity: 0.4,
          fillColor: '#ff6b35',
          pointerEvents: 'auto',
          opacity: 1,
        };
      }
      
      // Normal state: partial opacity, normal outline
      if (isDarkMode) {
        return {
          color: selected === feature.properties.Postal ? '#00e6ff' : color,
          weight: 2,
          fillOpacity: 0.25,
          fillColor: selected === feature.properties.Postal ? '#00e6ff' : color,
          pointerEvents: 'auto',
          opacity: 1,
        };
      } else {
        return {
          color: selected === feature.properties.Postal ? 'red' : color,
          weight: 2,
          fillOpacity: 0.4,
          fillColor: selected === feature.properties.Postal ? 'red' : color,
          pointerEvents: 'auto',
          opacity: 1,
        };
      }
    } catch (error) {
      console.warn('Error in style3 function:', error);
      return { fillOpacity: 0, opacity: 0 };
    }
  };

  // On 3-digit polygon click/hover
  const onEachFeature3 = (feature, layer) => {
    try {
      if (!feature || !feature.properties || !feature.properties.Postal) {
        return;
      }
      
      layer.on({
        click: (e) => {
          const zip3 = String(feature.properties.Postal).padStart(3, '0').trim();
          
          if (drawingMode === 'edit') {
            // Edit mode: always add/remove from selection
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
            
            setSelectedRegions(prev => {
              if (prev.includes(zip3)) {
                // Remove if already selected
                return prev.filter(z => z !== zip3);
              } else {
                // Add to selection
                return [...prev, zip3];
              }
            });
            // Clear single selection when in edit mode
            setSelected(null);
            return;
          } else {
            // Inspect mode: traditional single selection
            const zip3Display = feature.properties.Postal;
            setSelected(zip3Display);
          }
        },
        mouseout: (e) => {
          // Hide tooltip when mouse leaves the region
          if (layer.getTooltip()) {
            layer.closeTooltip();
          }
        }
      });
      const zip3 = String(feature.properties.Postal).padStart(3, '0').trim();
      const rep = reps[zip3] || 'Unassigned';
      layer.bindTooltip(`Zipcode: ${zip3}XX<br/>Rep: ${rep}`, {
        permanent: false,
        sticky: false
      });
    } catch (error) {
      console.warn('Error in onEachFeature3:', error);
    }
  };

  // Assign rep (update working draft, not backend)
  const assignRep = (zip3, rep) => {
    setWorkingZip3(prev => {
      const idx = prev.findIndex(r => String(r.Zipcode).padStart(3, '0').trim() === String(zip3).padStart(3, '0').trim());
      if (idx !== -1) {
        // Update existing
        const updated = [...prev];
        updated[idx] = { ...updated[idx], Sales_Rep: rep };
        return updated;
      } else {
        // Add new
        return [...prev, { Zipcode: zip3, Sales_Rep: rep }];
      }
    });
    // Keep the sidebar open - don't clear the selection
  };

  // Assign rep to multiple regions
  const assignRepToMultiple = (rep) => {
    if (selectedRegions.length === 0) return;
    
    setWorkingZip3(prev => {
      const updated = [...prev];
      selectedRegions.forEach(zip3 => {
        const idx = updated.findIndex(r => String(r.Zipcode).padStart(3, '0').trim() === String(zip3).padStart(3, '0').trim());
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], Sales_Rep: rep };
        } else {
          updated.push({ Zipcode: zip3, Sales_Rep: rep });
        }
      });
      return updated;
    });
    setSelectedRegions([]);
  };

  // Save multiple assignments without clearing selection
  const saveMultipleAssignments = () => {
    if (selectedRegions.length === 0 || !selectedRepForMultiple) return;
    
    setWorkingZip3(prev => {
      const updated = [...prev];
      selectedRegions.forEach(zip3 => {
        const idx = updated.findIndex(r => String(r.Zipcode).padStart(3, '0').trim() === String(zip3).padStart(3, '0').trim());
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], Sales_Rep: selectedRepForMultiple };
        } else {
          updated.push({ Zipcode: zip3, Sales_Rep: selectedRepForMultiple });
        }
      });
      return updated;
    });
    // Keep the selection - don't clear it
  };

  // Clear selected regions
  const clearSelectedRegions = () => {
    setSelectedRegions([]);
    // Also clear any drawn shapes from the map
    if (drawingLayerRef.current) {
      drawingLayerRef.current.clearLayers();
    }
    // Zoom to default continental US view (same as initial load)
    if (geoJsonLayer.current) {
      const L = window.L || require('leaflet');
      const continentalUSBounds = L.latLngBounds(
        L.latLng(30, -135), // Southwest: Same as initial load bounds
        L.latLng(57, -75)   // Northeast: Same as initial load bounds
      );
      geoJsonLayer.current._map.fitBounds(continentalUSBounds, { padding: [20, 20] });
    }
  };

  // Clear single selection and zoom to full map view
  const clearSingleSelection = () => {
    setSelected(null);
    // Zoom to default continental US view (same as initial load)
    if (geoJsonLayer.current) {
      const L = window.L || require('leaflet');
      const continentalUSBounds = L.latLngBounds(
        L.latLng(30, -135), // Southwest: Same as initial load bounds
        L.latLng(57, -75)   // Northeast: Same as initial load bounds
      );
      geoJsonLayer.current._map.fitBounds(continentalUSBounds, { padding: [20, 20] });
    }
  };

  // Handle solo rep with zoom functionality
  const handleSoloRep = (repName) => {
    const newSoloRep = soloRep === repName ? null : repName;
    setSoloRep(newSoloRep);
    
    // If unsoloing (going back to show all), zoom to default continental US view
    if (!newSoloRep && geoJsonLayer.current) {
      const L = window.L || require('leaflet');
      const continentalUSBounds = L.latLngBounds(
        L.latLng(30, -135), // Southwest: Same as initial load bounds
        L.latLng(57, -75)   // Northeast: Same as initial load bounds
      );
      geoJsonLayer.current._map.fitBounds(continentalUSBounds, { padding: [20, 20] });
    }
  };

  // Find the selected feature for zooming
  const selectedFeature = selected && zip3Geojson
    ? zip3Geojson.features.find(f => String(f.properties.Postal).padStart(3, '0').trim() === String(selected).padStart(3, '0').trim())
    : null;

  // Live dark mode detection for map tiles
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setIsDarkMode(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const tileUrl = isDarkMode
    ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const tileAttribution = isDarkMode
    ? '&copy; OpenMapTiles &copy; OpenStreetMap contributors'
    : '&copy; CartoDB &copy; OpenStreetMap contributors';

  // Memoize style and event functions for performance (after isDarkMode is defined)
  const memoizedStyle3 = React.useMemo(() => style3, [reps, customColors, isDarkMode, soloRep, selectedRegions, selected]);
  const memoizedOnEachFeature3 = React.useMemo(() => onEachFeature3, [drawingMode, setSelectedRegions, setSelected, reps]);

  // Delete rep
  const handleDeleteRep = async (rep) => {
    // Find all zip3s assigned to this rep
    const assignedZip3s = Object.entries(reps)
      .filter(([zip3, r]) => r === rep.Name)
      .map(([zip3]) => zip3);
    if (assignedZip3s.length > 0) {
      setDeleteModal({ open: true, rep, zip3s: assignedZip3s, newRep: '' });
    } else {
      if (!window.confirm(`Delete rep ${rep.Name}? This cannot be undone.`)) return;
      setWorkingReps(prev => prev.filter(r => r.Name !== rep.Name));
      setRepsList(prev => prev.filter(r => r.Name !== rep.Name));
    }
  };

  // Handle confirm in delete modal
  const handleConfirmReassignAndDelete = async () => {
    const { rep, zip3s, newRep } = deleteModal;
    if (!newRep) return;
    // Reassign all zip3s to newRep
    for (const zip3 of zip3s) {
      await fetch('http://localhost:3001/api/zip3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Zipcode: zip3, Sales_Rep: newRep }),
      });
    }
    // Delete the rep
    const res = await fetch(`http://localhost:3001/api/reps/${encodeURIComponent(rep.Name)}`, { method: 'DELETE' });
    if (res.ok) {
      setRepsList((prev) => prev.filter(r => r.Name !== rep.Name));
      setDeleteModal({ open: false, rep: null, zip3s: [], newRep: '' });
      // Refresh the page after successful delete
      window.location.reload();
    } else {
      alert('Error deleting rep');
    }
  };

  // Handle cancel in delete modal
  const handleCancelDeleteModal = () => setDeleteModal({ open: false, rep: null, zip3s: [], newRep: '' });

  // Track if working draft has unpublished changes
  const hasUnpublishedChanges = JSON.stringify(workingZip3) !== JSON.stringify(lastPublishedDraft?.zip3Assignments) ||
    JSON.stringify(workingReps) !== JSON.stringify(lastPublishedDraft?.repsList);

  // Draft dropdown refs and outside click effect
  const draftBtnRef = useRef();
  const draftDropdownRef = useRef();
  useEffect(() => {
    if (!showDraftDropdown) return;
    function handleClick(e) {
      if (
        draftDropdownRef.current &&
        !draftDropdownRef.current.contains(e.target) &&
        draftBtnRef.current &&
        !draftBtnRef.current.contains(e.target)
      ) {
        setShowDraftDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDraftDropdown]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;
    function handleClick(e) {
      // Check if click is outside the color picker dropdown
      const colorPickerDropdown = document.querySelector('.color-picker-dropdown');
      if (colorPickerDropdown && !colorPickerDropdown.contains(e.target)) {
        setShowColorPicker(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColorPicker]);

  // Clear selected region when soloing a rep
  useEffect(() => {
    if (soloRep) setSelected(null);
  }, [soloRep]);



  // Zoom to soloed rep's regions
  useEffect(() => {
    if (!zip3Geojson || !geoJsonLayer.current || drawingMode === 'edit') return;
    const L = window.L || require('leaflet');
    try {
      if (soloRep) {
        const repZip3s = Object.entries(reps)
          .filter(([zip3, r]) => r === soloRep)
          .map(([zip3]) => zip3);
        const features = zip3Geojson.features.filter(f => repZip3s.includes(String(f.properties.Postal).padStart(3, '0').trim()));
        if (features.length === 0) return;
        const geojson = { type: 'FeatureCollection', features };
        const layer = L.geoJSON(geojson);
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid() && bounds.getNorthEast() && bounds.getSouthWest()) {
          geoJsonLayer.current._map.fitBounds(bounds, { padding: [40, 40] });
        }
      } else if (!selected && !hasZoomedInitially.current) {
        // Only zoom to continental US on initial load, not when clearing selection
        const continentalUSBounds = L.latLngBounds(
          L.latLng(30, -135), // Southwest: Same as initial load bounds
          L.latLng(57, -75)   // Northeast: Same as initial load bounds
        );
        geoJsonLayer.current._map.fitBounds(continentalUSBounds, { padding: [20, 20] });
        hasZoomedInitially.current = true;
      }
    } catch (error) {
      console.warn('Error in solo rep zoom:', error);
    }
  }, [soloRep, zip3Geojson, reps, drawingMode, selected]);

  // Zoom to selected region when not soloing
  useEffect(() => {
    if (!zip3Geojson || !geoJsonLayer.current || !selected || soloRep || drawingMode === 'edit') return;
    const L = window.L || require('leaflet');
    try {
      const feature = zip3Geojson.features.find(f => String(f.properties.Postal).padStart(3, '0').trim() === String(selected).padStart(3, '0').trim());
      if (!feature) return;
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid && bounds.isValid() && bounds.getNorthEast() && bounds.getSouthWest()) {
        // Check if we're already zoomed in (zoom level > 6 means we're zoomed in)
        const currentZoom = geoJsonLayer.current._map.getZoom();
        if (currentZoom > 6) {
          // We're already zoomed in, don't zoom to full map view
          return;
        }
        
        geoJsonLayer.current._map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (error) {
      console.warn('Error in selected region zoom:', error);
    }
  }, [selected, soloRep, zip3Geojson, drawingMode]);

  // Reset hasZoomedInitially when geojson changes
  useEffect(() => {
    hasZoomedInitially.current = false;
  }, [zip3Geojson]);

  // Loading state
  if (isLoadingGeoJSON) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          color: '#0c5460', 
          backgroundColor: '#d1ecf1', 
          border: '1px solid #bee5eb', 
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3>Loading Map Data...</h3>
          <p>Please wait while the map data is being loaded.</p>
        </div>
      </div>
    );
  }

  // Fallback UI if GeoJSON is not loaded
  if (!zip3Geojson) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          color: '#721c24', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3>Map Data Not Available</h3>
          <p>Failed to load map data. Please check your network connection and ensure the backend server is running.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="sidebar">
        <div className="logo-spot">
          <img src="/logo192.png" alt="Logo" />
        </div>
        <div className="sidebar-content">
          {selectedRegions.length > 0 ? (
            <>
              <h3>Assign Sales Rep to {selectedRegions.length} Regions</h3>
              <div style={{ marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
                Selected: {selectedRegions.slice(0, 5).join(', ')}
                {selectedRegions.length > 5 && ` +${selectedRegions.length - 5} more`}
              </div>
              {(() => {
                // Check if all selected regions have the same rep
                const selectedReps = selectedRegions.map(zip3 => reps[zip3]).filter(Boolean);
                const uniqueReps = [...new Set(selectedReps)];
                const allSameRep = uniqueReps.length === 1 && selectedReps.length > 0;
                const currentRep = allSameRep ? uniqueReps[0] : '';
                
                // Use selectedRepForMultiple if set, otherwise use current rep if all regions have the same rep
                const displayValue = selectedRepForMultiple || currentRep;
                
                return (
                  <select
                    id="multi-rep-select"
                    style={{ width: '100%', marginBottom: 10, padding: 6, fontSize: '1em' }}
                    onChange={e => setSelectedRepForMultiple(e.target.value)}
                    disabled={workingReps.length === 0}
                    value={displayValue}
                  >
                    <option value="">{uniqueReps.length > 1 ? 'Multiple reps selected' : 'Select a rep...'}</option>
                    {workingReps.length === 0 ? (
                      <option disabled>Loading...</option>
                    ) : (
                      workingReps.map(r => (
                        <option key={r.Name} value={r.Name}>{r.Name}</option>
                      ))
                    )}
                  </select>
                );
              })()}
              <button 
                style={{ marginBottom: 10 }} 
                className="primary-btn"
                onClick={saveMultipleAssignments}
                disabled={!selectedRepForMultiple}
              >
                Save
              </button>
              <button className="secondary-btn" onClick={clearSelectedRegions} style={{ width: '100%' }}>
                Clear Selection
              </button>
            </>
          ) : selected ? (
            <>
              <h3>Assign Sales Rep to {selected}XX</h3>
              <select
                value={selectedRep}
                id="rep-select"
                style={{ width: '100%', marginBottom: 10, padding: 6, fontSize: '1em' }}
                onChange={e => setSelectedRep(e.target.value)}
                disabled={workingReps.length === 0}
              >
                <option value="">Unassigned</option>
                {workingReps.length === 0 ? (
                  <option disabled>Loading...</option>
                ) : (
                  workingReps.map(r => (
                    <option key={r.Name} value={r.Name}>{r.Name}</option>
                  ))
                )}
              </select>
              <button style={{ marginBottom: 10 }} className="primary-btn"
                onClick={() => {
                  const rep = selectedRep;
                  assignRep(String(selected).padStart(3, '0').trim(), rep);
                }}
              >
                Save
              </button>
              <button className="secondary-btn" onClick={clearSingleSelection}>Cancel</button>
            </>
          ) : (
            <div className="sidebar-message">
              <span>
                {drawingMode === 'inspect' 
                  ? 'Click a region to inspect and assign it'
                  : 'Click regions to add them to selection, or use drawing tools'
                }
                {selectedRegions.length > 0 && drawingMode === 'edit' && (
                  <div style={{ 
                    marginTop: 8, 
                    fontSize: '0.85em', 
                    color: '#666',
                  }}>
                    💡 Click regions to add/remove them from selection
                  </div>
                )}
              </span>
            </div>
          )}
        </div>
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
          {hasUnpublishedChanges && (
            <div className="unpublished-note">You have unpublished changes.</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button className="primary-btn" onClick={handlePublish} disabled={!hasUnpublishedChanges} style={{ flex: 1 }}>
              Publish
            </button>
            {/* Revert button: only visible if changes are present, now between Publish and Drafts */}
            {hasUnpublishedChanges && (
              <div style={{ position: 'relative', animation: 'fadeInSlide 0.3s' }}>
                <button
                  className="circle-btn"
                  onClick={() => {
                    if (!hasUnpublishedChanges || !lastPublishedDraft) return;
                    setWorkingZip3([...lastPublishedDraft.zip3Assignments]);
                    setWorkingReps([...lastPublishedDraft.repsList]);
                  }}
                  title="Revert to last published configuration"
                  aria-label="Revert to last published configuration"
                  disabled={!hasUnpublishedChanges}
                  style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                </button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button
                className="circle-btn"
                ref={draftBtnRef}
                onClick={() => setShowDraftDropdown(d => !d)}
                title="Draft options"
                aria-label="Draft options"
                style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
              >
                <FontAwesomeIcon icon={faFolderOpen} />
              </button>
              {showDraftDropdown && (
                <div
                  className="draft-dropdown"
                  ref={draftDropdownRef}
                  style={{ position: 'absolute', right: 0, bottom: 48, background: '#fff', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', zIndex: 10, minWidth: 180 }}
                >
                  <div style={{ borderBottom: '1px solid #eee', fontWeight: 600 }}>
                  <button className="dropdown-item" style={{ width: '100%', textAlign: 'left', borderBottom: '1px solid #eee', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setShowDraftDropdown(false); setShowSaveDraftModal(true); }}>
                    <FontAwesomeIcon icon={faSave} style={{ marginRight: 8 }} /> Save as New Draft
                  </button>
                  </div>
                  <div style={{ padding: '8px 12px 0px 12px', fontSize: '0.97em', color: '#888' }}>Recall Draft:</div>
                  {drafts.length === 0 && <div style={{ padding: '8px 12px 12px 12px', color: '#aaa' }}>No drafts</div>}
                  {drafts.filter(d => d.name !== 'Direct Publish').map(d => (
                    <button
                      key={d.id}
                      className="dropdown-item"
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: currentDraftId === d.id ? '#07314f' : undefined, fontWeight: currentDraftId === d.id ? 600 : 400 }}
                      onClick={() => { setShowDraftDropdown(false); handleLoadDraft(d.id); }}
                    >
                      {d.name} <span style={{ fontSize: '0.92em', color: '#aaa' }}>({new Date(d.timestamp).toLocaleDateString()})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="map-container" style={{ position: 'relative' }}>
        {/* Rep Color Legend (collapsible) */}
        <div style={{
          position: 'absolute',
          top: 18,
          right: 18,
          zIndex: 2000,
          background: showLegend ? '#fff' : 'none',
          border: showLegend ? '1px solid #eee' : 'none',
          color: '#072740',
          borderRadius: showLegend ? 10 : '50%',
          boxShadow: showLegend ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
          padding: showLegend ? '12px 16px 8px 16px' : 0,
          minWidth: showLegend ? 260 : 50,
          minHeight: showLegend ? undefined : 40,
          width: showLegend ? undefined : 50,
          height: showLegend ? undefined : 40,
          maxWidth: 480,
          fontSize: '0.98em',
          display: 'flex',
          flexDirection: showLegend ? 'column' : 'row',
          alignItems: showLegend ? 'stretch' : 'center',
          justifyContent: showLegend ? 'flex-start' : 'center',
          transition: 'padding 0.2s, min-width 0.2s, border-radius 0.2s, width 0.2s, height 0.2s, background 0.2s, box-shadow 0.2s, border 0.2s',
        }}>
            {showLegend ? (
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, textAlign: 'left', paddingRight: 0, color: '#072740', fontWeight: 600, justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Rep Legend ({workingReps.length})</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleOpenAddRep}
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      minHeight: 32,
                      maxWidth: 32,
                      maxHeight: 32,
                      borderRadius: '50%',
                      background: '#e4e9f0',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                      padding: 0,
                    }}
                    title="Add Rep"
                    aria-label="Add Rep"
                  >
                    <FontAwesomeIcon icon={faPlus} style={{ color: '#07314f' }} />
                  </button>
                  <button
                    onClick={() => setShowLegend(v => !v)}
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      minHeight: 32,
                      maxWidth: 32,
                      maxHeight: 32,
                      borderRadius: '50%',
                      background: '#e4e9f0',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: '#07314f',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                      padding: 0,
                    }}
                    title={showLegend ? 'Hide legend' : 'Show legend'}
                    aria-label={showLegend ? 'Hide legend' : 'Show legend'}
                  >
                    <FontAwesomeIcon icon={faChevronUp} style={{ color: '#07314f', fontSize: 16, verticalAlign: 'middle' }} />
                  </button>
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowLegend(v => !v)}
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  maxWidth: 32,
                  maxHeight: 32,
                  borderRadius: '50%',
                  background: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: '#07314f',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  padding: 0,
                  margin: 0,
                }}
                title={showLegend ? 'Hide legend' : 'Show legend'}
                aria-label={showLegend ? 'Hide legend' : 'Show legend'}
              >
                 <FontAwesomeIcon icon={faChevronUp} style={{ color: '#07314f', fontSize: 16, transform: 'rotate(180deg)', verticalAlign: 'middle' }} />
              </button>
            )}
          {showLegend && (
            <>
              <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 0,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'none',
                  maxHeight: '45vh',
                  overflowY: 'auto',
                }}>
                  {workingReps.map((rep, idx) => (
                    <div
                      key={rep.Name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 0',
                        opacity: soloRep && soloRep !== rep.Name ? 0.5 : 1,
                        borderBottom: idx !== workingReps.length - 1 ? '1px solid #dde3ea' : 'none',
                        background: 'none',
                        minHeight: 36,
                        fontSize: '0.97em',
                      }}
                    >
                       <div style={{ position: 'relative' }}>
                         <span
                           className="color-swatch"
                           style={{
                             background: getRepColor(rep.Name),
                           }}
                           onClick={(e) => {
                             const rect = e.currentTarget.getBoundingClientRect();
                             const viewportWidth = window.innerWidth;
                             const viewportHeight = window.innerHeight;
                             
                             // Calculate position with fallbacks for edge cases
                             let top = rect.bottom + 5;
                             let left = rect.left;
                             
                             // If it would go off the bottom, position above the swatch
                             if (top + 200 > viewportHeight) {
                               top = rect.top - 200;
                             }
                             
                             // If it would go off the right, adjust left position
                             if (left + 250 > viewportWidth) {
                               left = viewportWidth - 260;
                             }
                             
                             // Ensure it doesn't go off the left
                             if (left < 10) {
                               left = 10;
                             }
                             
                             setColorPickerPosition({ top, left });
                             setShowColorPicker(showColorPicker === rep.Name ? null : rep.Name);
                           }}
                           title="Customize color"
                         />

                         {showColorPicker === rep.Name && (
                           <div 
                             data-color-picker
                             className="color-picker-dropdown"
                             style={{
                               position: 'fixed',
                               top: `${colorPickerPosition.top}px`,
                               left: `${colorPickerPosition.left}px`,
                               zIndex: 10000,
                             }}
                           >
                             <div style={{ marginBottom: 8, fontSize: '0.9em', fontWeight: 600 }}>Customize {rep.Name}'s color</div>
                             <div className="color-picker-grid">
                               {repColors.slice(0, 18).map((color, colorIdx) => (
                                 <button
                                   key={colorIdx}
                                   className="color-option"
                                   onClick={() => updateRepColor(rep.Name, color)}
                                   style={{ background: color }}
                                   title={color}
                                 />
                               ))}
                             </div>
                             <div className="color-picker-controls">
                               <input
                                 type="color"
                                 className="color-picker-input"
                                 value={customColors[rep.Name] || getRepColor(rep.Name)}
                                 onChange={(e) => updateRepColor(rep.Name, e.target.value)}
                                 title="Custom color picker"
                               />
                               <button
                                 className="color-picker-close"
                                 onClick={() => setShowColorPicker(null)}
                               >
                                 Close
                               </button>
                             </div>
                           </div>
                         )}
                       </div>
                       <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, fontSize: '0.97em' }}>{rep.Name}</span>
                       <span style={{ flex: 1 }} />
                       <button 
                         type="button" 
                         onClick={() => handleSoloRep(rep.Name)} 
                         title={soloRep === rep.Name ? 'Show all reps' : `Solo ${rep.Name}`} 
                         aria-label={soloRep === rep.Name ? 'Show all reps' : `Solo ${rep.Name}`} 
                         style={{ 
                           marginLeft: 8, 
                           fontSize: 13, 
                           padding: 0, 
                           minWidth: 0, 
                           minHeight: 0, 
                           height: 22, 
                           width: 22, 
                           display: 'flex', 
                           alignItems: 'center', 
                           justifyContent: 'center',
                           background: 'none',
                           border: 'none',
                           cursor: 'pointer',
                           color: soloRep === rep.Name ? '#07314f' : '#999'
                         }}
                       >
                         <FontAwesomeIcon 
                           icon={faCircle} 
                           style={{ 
                             fontSize: 13,
                             opacity: soloRep === rep.Name ? 1 : 0.3
                           }} 
                         />
                       </button>
                       <button className="rep-edit-btn" type="button" onClick={() => handleOpenEditRep(rep)} title="Edit" aria-label="Edit" style={{ marginLeft: 4, fontSize: 13, padding: 0, minWidth: 0, minHeight: 0, height: 22, width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 13, color: '#07314f' }} />
                       </button>
                       <button className="rep-delete-btn" type="button" onClick={() => handleDeleteRep(rep)} title="Delete" aria-label="Delete" style={{ marginLeft: 4, fontSize: 13, padding: 0, minWidth: 0, minHeight: 0, height: 22, width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                       </button>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
        
        {/* Drawing Tools Toggle */}
        <div style={{
          position: 'absolute',
          bottom: 18,
          left: 18,
          zIndex: 2001,
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          padding: 8,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setDrawingMode('inspect')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: drawingMode === 'inspect' ? '#07314f' : '#f8f9fa',
                color: drawingMode === 'inspect' ? '#fff' : '#07314f',
                border: '1px solid #ddd',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              title="Inspect mode - click to inspect and assign individual regions"
            >
              <FontAwesomeIcon icon={faMousePointer} />
              Inspect
            </button>
            <button
              onClick={() => setDrawingMode('edit')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: drawingMode === 'edit' ? '#07314f' : '#f8f9fa',
                color: drawingMode === 'edit' ? '#fff' : '#07314f',
                border: '1px solid #ddd',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              title="Edit mode - click regions or draw shapes to select multiple for bulk assignment"
            >
              <FontAwesomeIcon icon={faDrawPolygon} />
              Edit
            </button>
          </div>
          {selectedRegions.length > 0 && (
            <div style={{
              marginTop: 8,
              padding: '6px 8px',
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: 4,
              fontSize: '0.8em',
              color: '#856404',
            }}>
              {selectedRegions.length} regions selected
            </div>
          )}
          {selectedRegions.length > 0 && drawingMode === 'edit' && (
            <div style={{
              marginTop: 4,
              padding: '4px 8px',
              background: '#e3f2fd',
              border: '1px solid #bbdefb',
              borderRadius: 4,
              fontSize: '0.75em',
              color: '#1976d2',
            }}>
              Click regions to add/remove from selection
            </div>
          )}
        </div>
        
      <ErrorBoundary>
        <MapContainer 
          center={[39.5, -98.35]} 
          zoom={4} 
          style={{ height: '100%', width: '100%' }}
          doubleClickZoom={false}
          zoomControl={true}
          scrollWheelZoom={true}
          dragging={true}
          touchZoom={true}
          boxZoom={false}
          keyboard={false}
        >
          <TileLayer
              url={tileUrl}
              attribution={tileAttribution}
            />
          {zip3Geojson && zip3Geojson.features && zip3Geojson.features.length > 0 && (
            <GeoJSON
                key={`${JSON.stringify(workingZip3)}-${selectedRegions.length}-${drawingMode}`}
                data={{
                  ...zip3Geojson,
                  features: zip3Geojson.features.map(f => ({
                    ...f,
                    properties: {
                      ...f.properties,
                      rep: reps[String(f.properties.Postal).padStart(3, '0').trim()] || 'Unassigned',
                    },
                  })),
                }}
                          style={memoizedStyle3}
            onEachFeature={memoizedOnEachFeature3}
              ref={geoJsonLayer}
            />
          )}
                      <DrawingControls 
              drawingMode={drawingMode}
              setDrawingMode={setDrawingMode}
              selectedRegions={selectedRegions}
              setSelectedRegions={setSelectedRegions}
              zip3Geojson={zip3Geojson}
              reps={reps}
              assignRep={assignRep}
              drawingLayerRef={drawingLayerRef}
              setSelected={setSelected}
            />
          <MapClickHandler 
            drawingMode={drawingMode}
            selected={selected}
            setSelected={setSelected}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
          />
          {drawingMode !== 'edit' && (
            <FitBounds geojson={zip3Geojson} selectedFeature={selectedFeature} hasZoomedInitially={hasZoomedInitially} selectedRegions={selectedRegions} drawingMode={drawingMode} />
          )}
          </MapContainer>
      </ErrorBoundary>
      </div>
      {/* Add/Edit Rep Modal */}
      {showAddRep && (
        <div className="modal-overlay" onClick={handleCloseAddRep}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <form className="add-rep-form" onSubmit={handleAddRep}>
              <h2>{editRep ? 'Edit Rep' : 'Add New Rep'}</h2>
              <input
                type="text"
                placeholder="Name"
                value={newRep.Name}
                onChange={e => setNewRep(r => ({ ...r, Name: e.target.value }))}
                readOnly={!!editRep}
                style={editRep ? { background: '#eee', color: '#888', cursor: 'not-allowed' } : {}}
              />
              <input
                type="email"
                placeholder="Email"
                value={newRep.Email}
                onChange={e => setNewRep(r => ({ ...r, Email: e.target.value }))}
              />
          <input
            type="text"
                placeholder="Phone Number"
                value={newRep['Phone Number']}
                onChange={handlePhoneInputChange}
                maxLength="12"
              />
              {repError && <div className="rep-error">{repError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="primary-btn" type="submit">{editRep ? 'Save Changes' : 'Add Rep'}</button>
                <button className="secondary-btn" type="button" onClick={handleCloseAddRep}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete/Reassign Modal */}
      {deleteModal.open && (
        <div className="modal-overlay" onClick={handleCancelDeleteModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reassign & Delete Rep</h2>
            <p>Rep <b>{deleteModal.rep.Name}</b> is assigned to the following regions:</p>
            <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 12, fontSize: '0.98em', background: '#f6f8fa', borderRadius: 8, padding: 8, border: '1px solid #dde3ea' }}>
              {deleteModal.zip3s.map(z => <span key={z} style={{ marginRight: 8 }}>{z}XX</span>)}
            </div>
            <label htmlFor="reassign-select">Reassign these regions to:</label>
            <select
              id="reassign-select"
              className="modal-select"
              value={deleteModal.newRep}
              onChange={e => setDeleteModal(m => ({ ...m, newRep: e.target.value }))}
              style={{ width: '100%', margin: '10px 0 18px 0', padding: 8, borderRadius: 8 }}
            >
              <option value="">Select a rep...</option>
              {workingReps.filter(r => r.Name !== deleteModal.rep.Name).map(r => (
                <option key={r.Name} value={r.Name}>{r.Name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="primary-btn" disabled={!deleteModal.newRep} onClick={handleConfirmReassignAndDelete} type="button">Reassign & Delete</button>
              <button className="secondary-btn" onClick={handleCancelDeleteModal} type="button">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Save Draft Modal */}
      {showSaveDraftModal && (
        <div className="modal-overlay" onClick={() => setShowSaveDraftModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Save As Draft</h2>
            <input
              type="text"
              placeholder="Draft name"
              value={saveDraftName}
              onChange={e => setSaveDraftName(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary-btn" onClick={handleSaveDraft} disabled={!saveDraftName}>Save</button>
              <button className="secondary-btn" onClick={() => setShowSaveDraftModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Publish Confirmation Modal */}
      {showPublishConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowPublishConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirm Publish</h2>
            <p>Are you sure you want to publish this configuration? This will overwrite the live assignments and reps.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="primary-btn" onClick={handleConfirmPublish}>Publish</button>
              <button className="secondary-btn" onClick={() => setShowPublishConfirmModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Backend log panel */}
      <div className="backend-log-panel">
        {logMessages.map(l => (
          <div key={l.id} className={`log-msg log-${l.type}`}>{l.msg} <span className="log-time">{l.time.toLocaleTimeString()}</span></div>
        ))}
      </div>
    </div>
  );
}

export default App;
