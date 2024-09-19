console.log('Perplexity response logger is running');

let mapIframe;
let mapContainer;
let isMapVisible = false;
let isProcessing = false;

function createMapContainer() {
    console.log('Creating map container');
    mapContainer = document.createElement('div');
    mapContainer.id = 'extension-mapbox-container';
    mapContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        height: 300px;
        z-index: 2147483647;
        border: 2px solid #ccc;
        border-radius: 8px;
        overflow: hidden;
        display: none;
        background-color: white;
    `;
    mapIframe = document.createElement('iframe');
    mapIframe.src = chrome.runtime.getURL('map.html');
    mapIframe.id = 'extension-mapbox-iframe';
    mapIframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
    `;
    mapContainer.appendChild(mapIframe);
    document.body.appendChild(mapContainer);
    console.log('Map container created');
    
    mapIframe.onload = function() {
        console.log('Map iframe loaded');
        mapIframe.contentWindow.postMessage({type: 'INITIALIZE_MAP'}, '*');
    };
    
    createToggleButton();
    createStatusIndicator();
}

function createToggleButton() {
    const button = document.createElement('button');
    button.textContent = 'Show Map';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483648;
        padding: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    `;
    button.addEventListener('click', toggleMapVisibility);
    document.body.appendChild(button);
}

function createStatusIndicator() {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'extension-status-indicator';
    statusIndicator.style.cssText = `
        position: fixed;
        bottom: 60px;
        right: 20px;
        z-index: 2147483648;
        padding: 5px 10px;
        background-color: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 3px;
        font-size: 12px;
        display: none;
    `;
    document.body.appendChild(statusIndicator);
}

function toggleMapVisibility() {
    isMapVisible = !isMapVisible;
    mapContainer.style.display = isMapVisible ? 'block' : 'none';
    const button = document.querySelector('button');
    button.textContent = isMapVisible ? 'Hide Map' : 'Show Map';
    if (isMapVisible) {
        mapIframe.contentWindow.postMessage({type: 'RESIZE_MAP'}, '*');
    }
}

function showStatus(message, isError = false, duration = 3000) {
    const statusIndicator = document.getElementById('extension-status-indicator');
    statusIndicator.textContent = message;
    statusIndicator.style.backgroundColor = isError ? '#ffcccc' : '#f0f0f0';
    statusIndicator.style.display = 'block';
    clearTimeout(statusIndicator.timeoutId);
    statusIndicator.timeoutId = setTimeout(() => {
        statusIndicator.style.display = 'none';
    }, duration);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedReadClipboard = debounce(readClipboardContent, 300);

function listenForCopyEvents() {
    document.body.addEventListener('click', function(event) {
        const copyButton = event.target.closest('button[data-state="closed"]');
        if (copyButton && copyButton.querySelector('svg.fa-clipboard')) {
            showStatus('Processing clipboard content...');
            setTimeout(() => {
                debouncedReadClipboard();
            }, 100);
        }
    }, true);
}

function isExtensionContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.getManifest();
}

function readClipboardContent() {
    if (!isExtensionContextValid()) {
        showStatus('Extension context invalid. Please refresh the page.', true);
        console.error('Extension context invalidated. Reloading page in 5 seconds...');
        setTimeout(() => {
            window.location.reload();
        }, 5000);
        return;
    }

    if (isProcessing) {
        showStatus('Still processing previous request. Please wait.', true);
        return;
    }

    isProcessing = true;
    showStatus('Reading clipboard...');

    navigator.clipboard.readText()
        .then(text => {
            if (text) {
                console.log('Clipboard content:', text);
                showStatus('Extracting districts...');
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({action: "extractDistricts", text: text}, function(response) {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
            } else {
                throw new Error('Clipboard is empty');
            }
        })
        .then(response => {
            if (response.districts) {
                console.log('Extracted districts:', response.districts);
                if (response.districts.length === 0) {
                    showStatus('No districts found in the text', true, 5000);
                    return;
                }
                showStatus('Updating map...');
                mapIframe.contentWindow.postMessage({
                    type: 'UPDATE_DISTRICTS',
                    data: response.districts
                }, '*');
                if (!isMapVisible) {
                    toggleMapVisibility();
                }
                showStatus('Map updated successfully');
            } else if (response.error) {
                throw new Error(response.error);
            }
        })
        .catch(err => {
            console.error('Error processing clipboard content:', err);
            showStatus(`Error: ${err.message}`, true, 10000);
            if (err.message.includes('Extension context invalidated')) {
                console.error('Extension context invalidated. Reloading page in 5 seconds...');
                setTimeout(() => {
                    window.location.reload();
                }, 5000);
            }
        })
        .finally(() => {
            isProcessing = false;
        });
}

function initializeExtension() {
    console.log('Initializing extension');
    createMapContainer();
    listenForCopyEvents();
}

// Run the initialization after a short delay to ensure the page is fully loaded
setTimeout(initializeExtension, 2000);

console.log('Content script fully loaded');

// Listen for messages from the iframe
window.addEventListener('message', function(event) {
    if (event.data.type === 'MAP_INITIALIZED') {
        console.log('Map initialized in iframe');
    }
});