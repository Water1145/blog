let map;
let userMarker;
let watchId;
let ipBasedLocation = null;
const statusElement = document.getElementById('status');
const welcomeModal = document.getElementById('welcomeModal');
const locationModal = document.getElementById('locationModal');
const ipLocationInfo = document.getElementById('ipLocationInfo');
const locationDetails = document.getElementById('locationDetails');
const requestLocationBtn = document.getElementById('requestLocation');
const continueWithoutBtn = document.getElementById('continueWithout');
const closeLocationModal = document.getElementById('closeLocationModal');

window.addEventListener('DOMContentLoaded', () => {
    welcomeModal.style.display = 'flex';
    getIPLocation();
});

requestLocationBtn.addEventListener('click', () => {
    welcomeModal.style.display = 'none';
    requestUserLocation();
});

continueWithoutBtn.addEventListener('click', () => {
    welcomeModal.style.display = 'none';
    if (ipBasedLocation) {
        initMapWithIPLocation();
    } else {
        initDefaultMap();
    }
});

closeLocationModal.addEventListener('click', () => {
    locationModal.style.display = 'none';
});

function getIPLocation() {
    axios.get('https://ipapi.co/json/')
        .then(response => {
            const data = response.data;
            ipBasedLocation = {
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city,
                region: data.region,
                country: data.country_name
            };
            
            ipLocationInfo.innerHTML = `
                <p>您可能位于：</p>
                <p><strong>${data.city}, ${data.region}, ${data.country_name}</strong></p>
            ;
        })
        .catch(error => {
            console.error('获取IP位置失败:', error);
            ipLocationInfo.innerHTML = `<p>无法确定您的IP位置</p>`;
        });
}

function requestUserLocation() {
    statusElement.textContent = "正在请求精确位置权限...";
    
    if (!navigator.geolocation) {
        statusElement.textContent = "您的浏览器不支持地理位置功能";
        if (ipBasedLocation) {
            initMapWithIPLocation();
        } else {
            initDefaultMap();
        }
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        position => {
            showPreciseLocation(position);
            initMap(position);
        },
        error => {
            showError(error);
            if (ipBasedLocation) {
                initMapWithIPLocation();
            } else {
                initDefaultMap();
            }
        },
        { enableHighAccuracy: true }
    );
}

function showPreciseLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
        .then(response => response.json())
        .then(data => {
            const address = data.address || {};
            const city = address.city || address.town || address.village || address.county;
            const region = address.state || address.region;
            const country = address.country;
            
            locationDetails.innerHTML = `
                <p>精确位置已获取:</p>
                <p><strong>${city ? city + ', ' : ''}${region ? region + ', ' : ''}${country || ''}</strong></p>
                <p>纬度: ${latitude.toFixed(6)}</p>
                <p>经度: ${longitude.toFixed(6)}</p>
                <p>精确度: ±${accuracy.toFixed(0)}米</p>
                <p>您现在可以享受精确的同城查询服务!</p>
            `;
            
            locationModal.style.display = 'flex';
            sendLocationToServer(latitude, longitude, accuracy, 'precise');
        })
        .catch(error => {
            console.error('获取地址信息失败:', error);
            locationDetails.innerHTML = `
                <p>精确位置已获取:</p>
                <p>纬度: ${latitude.toFixed(6)}</p>
                <p>经度: ${longitude.toFixed(6)}</p>
                <p>精确度: ±${accuracy.toFixed(0)}米</p>
            `;
            locationModal.style.display = 'flex';
        });
}

function initMapWithIPLocation() {
    statusElement.textContent = `使用IP位置: ${ipBasedLocation.city}, ${ipBasedLocation.region}`;
    
    map = L.map('map').setView([ipBasedLocation.latitude, ipBasedLocation.longitude], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.marker([ipBasedLocation.latitude, ipBasedLocation.longitude]).addTo(map)
        .bindPopup(`IP推测位置: ${ipBasedLocation.city}`)
        .openPopup();
    
    sendLocationToServer(ipBasedLocation.latitude, ipBasedLocation.longitude, 10000, 'ip_based');
}

function initDefaultMap() {
    statusElement.textContent = "使用默认地图位置";
    map = L.map('map').setView([39.9042, 116.4074], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function initMap(position) {
    const { latitude, longitude, accuracy } = position.coords;
    statusElement.textContent = `您的位置: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    map = L.map('map').setView([latitude, longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    userMarker = L.marker([latitude, longitude]).addTo(map)
        .bindPopup("您的精确位置")
        .openPopup();

    L.circle([latitude, longitude], {
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: accuracy
    }).addTo(map);

    watchId = navigator.geolocation.watchPosition(
        updatePosition,
        showError,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
}

function updatePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    statusElement.textContent = `您的位置: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
    if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
    }
    
    if (map) {
        map.setView([latitude, longitude]);
    }

    sendLocationToServer(latitude, longitude, accuracy, 'precise_update');
}

function sendLocationToServer(latitude, longitude, accuracy, type) {
    const data = {
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        type: type,
        timestamp: new Date().toISOString()
    };
    
    fetch('http://110.42.98.47:5000/map', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            console.error('服务器响应错误:', response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('位置数据已发送:', data);
    })
    .catch(error => {
        console.error('发送位置数据错误:', error);
    });
}

function showError(error) {
    let message;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "您拒绝了位置权限，将使用IP位置";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "位置信息不可用";
            break;
        case error.TIMEOUT:
            message = "获取位置超时";
            break;
        case error.UNKNOWN_ERROR:
            message = "发生未知错误";
            break;
    }
    statusElement.textContent = message;
    
    if (ipBasedLocation) {
        initMapWithIPLocation();
    } else {
        initDefaultMap();
    }
}

window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});
