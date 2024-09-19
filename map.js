console.log('Map script starting');
let map;
let currentStyle = 'dark';


mapboxgl.accessToken = 'pk.eyJ1IjoibWlsaW5kc29uaSIsImEiOiJjbDRjc2ZxaTgwMW5hM3Bqbmlka3VweWVkIn0.AM0QzfbGzUZc04vZ6o2uaw';

const styles = {
    light: 'mapbox://styles/mapbox/dark-v10',
    dark: 'mapbox://styles/mapbox/dark-v10'
};

function initializeMap() {
    console.log('Initializing map');
    map = new mapboxgl.Map({
        container: 'map',
        style: styles.light,
        center: [79.137088084514, 25.77876688761058],
        zoom: 4
    });

    map.on('load', function() {
        console.log('Map loaded');
        addStyleToggleControl();
        window.parent.postMessage({type: 'MAP_INITIALIZED'}, '*');
    });

    map.on('error', function(e) {
        console.error('Mapbox error:', e);
        showError('Error loading map: ' + e.error.message);
    });
}

function addStyleToggleControl() {
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Toggle Dark/Light';
    toggleButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1;
        padding: 5px 10px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
    `;
    toggleButton.addEventListener('click', toggleMapStyle);
    document.getElementById('map').appendChild(toggleButton);
}

function toggleMapStyle() {
    currentStyle = currentStyle === 'light' ? 'dark' : 'light';
    map.setStyle(styles[currentStyle]);
    console.log(`Switched to ${currentStyle} style`);
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function getDataUrl(districts) {
    const baseUrl = 'https://www.fused.io/server/v1/realtime-shared/fsh_5pcEczZ2zVRX6uJ7FkprMk/run/file';
    const queryParams = new URLSearchParams({
        dtype_out_vector: 'geojson',
        districts: JSON.stringify(districts)
    });
    return `${baseUrl}?${queryParams.toString()}`;
}

async function fetchGeoJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching GeoJSON:', error);
        showError('Error fetching district data: ' + error.message);
        return null;
    }
}

async function updateMap(districts) {
    console.log('Updating map with districts:', districts);
    const dataUrl = getDataUrl(districts);

    const geojsonData = await fetchGeoJSON(dataUrl);
    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
        console.error('Invalid or empty GeoJSON data');
        showError('No valid district data found');
        return;
    }

    if (map.getSource('districts')) {
        map.removeLayer('district-boundaries');
        map.removeLayer('district-fills');
        map.removeSource('districts');
    }

    map.addSource('districts', {
        type: 'geojson',
        data: geojsonData
    });

    map.addLayer({
        'id': 'district-fills',
        'type': 'fill',
        'source': 'districts',
        'paint': {
            'fill-color': '#627BC1',
            'fill-opacity': 0.5
        }
    });

    map.addLayer({
        'id': 'district-boundaries',
        'type': 'line',
        'source': 'districts',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#000000',
            'line-width': 1
        }
    });

    // Fit map to the GeoJSON data
    try {
        const bounds = new mapboxgl.LngLatBounds();
        let boundsExtended = false;

        geojsonData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates[0].forEach(coord => {
                        if (Array.isArray(coord) && coord.length >= 2) {
                            bounds.extend(coord);
                            boundsExtended = true;
                        }
                    });
                } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                        polygon[0].forEach(coord => {
                            if (Array.isArray(coord) && coord.length >= 2) {
                                bounds.extend(coord);
                                boundsExtended = true;
                            }
                        });
                    });
                }
            }
        });

        if (boundsExtended) {
            map.fitBounds(bounds, { padding: 20 });
        } else {
            console.warn('No valid coordinates found to fit bounds');
            // Fallback to a default view of India
            map.flyTo({
                center: [78.9629, 20.5937],
                zoom: 4
            });
        }
    } catch (error) {
        console.error('Error fitting bounds:', error);
        // Fallback to a default view of India
        map.flyTo({
            center: [78.9629, 20.5937],
            zoom: 4
        });
    }

    console.log('Map updated successfully');
}

// Listen for messages from the content script
window.addEventListener('message', function(event) {
    console.log('Received message:', event.data);
    if (event.data.type === 'INITIALIZE_MAP') {
        initializeMap();
    } else if (event.data.type === 'UPDATE_DISTRICTS') {
        updateMap(event.data.data);
    } else if (event.data.type === 'RESIZE_MAP') {
        map.resize();
    }
}, false);

console.log('Map script loaded, waiting for initialization message');