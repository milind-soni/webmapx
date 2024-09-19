console.log('Map initialization script starting');
let map;
let textOverlay;

function initializeMap() {
    console.log('Initializing map');
    mapboxgl.accessToken = 'pk.eyJ1IjoibWlsaW5kc29uaSIsImEiOiJjbDRjc2ZxaTgwMW5hM3Bqbmlka3VweWVkIn0.AM0QzfbGzUZc04vZ6o2uaw';
    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [0, 0],
            zoom: 1
        });
        map.on('load', function() {
            console.log('Map loaded successfully');
            createTextOverlay();
        });
        map.on('error', function(e) {
            console.error('Mapbox error:', e);
        });
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function createTextOverlay() {
    textOverlay = document.createElement('div');
    textOverlay.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        padding: 10px;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        max-height: 80%;
        overflow-y: auto;
    `;
    document.getElementById('map').appendChild(textOverlay);
}

function updateTextOverlay(text) {
    if (textOverlay) {
        textOverlay.textContent = text;
    }
}

window.addEventListener('message', function(event) {
    console.log('Message received:', event.data);
    if (event.data.type === 'UPDATE_TEXT') {
        console.log('Updating text overlay');
        updateTextOverlay(event.data.text);
    }
}, false);

initializeMap();
console.log('Map initialization script completed');