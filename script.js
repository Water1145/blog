// 初始化地图变量
let map;
let userMarker;
let watchId;
let ipBasedLocation = null;

// 获取DOM元素
const statusElement = document.getElementById('status');
const welcomeModal = document.getElementById('welcomeModal');
const locationModal = document.getElementById('locationModal');
const ipLocationInfo = document.getElementById('ipLocationInfo');
const locationDetails = document.getElementById('locationDetails');
const requestLocationBtn = document.getElementById('requestLocation');
const continueWithoutBtn = document.getElementById('continueWithout');
const closeLocationModal = document.getElementById('closeLocationModal');

// 显示欢迎弹窗并获取IP位置
window.addEventListener('DOMContentLoaded', () => {
    welcomeModal.style.display = 'flex';
    getIPLocation();
});

// 按钮事件
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

// 通过IP获取粗略位置
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
                <p>根据IP地址，您可能位于：</p>
                <p><strong>${data.city}, ${data.region}, ${data.country_name}</strong></p>
                <p>精确度: 城市级别 (约${data.postal ? data.postal + '区域' : '10-50公里范围'})</p>
            `;
        })
        .catch(error => {
            console.error('获取IP位置失败:', error);
            ipLocationInfo.innerHTML = `<p>无法确定您的IP位置</p>`;
        });
}

// 请求用户精确位置
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

// 显示精确位置信息
function showPreciseLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // 获取城市信息（使用Nominatim反向地理编码）
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
            
            // 发送位置数据到服务器
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

// 使用IP位置初始化地图
function initMapWithIPLocation() {
    statusElement.textContent = `使用IP位置: ${ipBasedLocation.city}, ${ipBasedLocation.region}`;
    
    map = L.map('map').setView([ipBasedLocation.latitude, ipBasedLocation.longitude], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // 添加标记，显示这是IP推测位置
    L.marker([ipBasedLocation.latitude, ipBasedLocation.longitude]).addTo(map)
        .bindPopup(`IP推测位置: ${ipBasedLocation.city}`)
        .openPopup();
    
    // 发送IP位置数据到服务器
    sendLocationToServer(ipBasedLocation.latitude, ipBasedLocation.longitude, 10000, 'ip_based');
}

// 初始化默认地图（当无法获取任何位置时）
function initDefaultMap() {
    statusElement.textContent = "使用默认地图位置";
    map = L.map('map').setView([39.9042, 116.4074], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// 初始化地图并显示用户精确位置
function initMap(position) {
    const { latitude, longitude, accuracy } = position.coords;
    statusElement.textContent = `您的位置: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
    // 创建地图实例
    map = L.map('map').setView([latitude, longitude], 15);
    
    // 添加OpenStreetMap图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // 添加用户位置标记
    userMarker = L.marker([latitude, longitude]).addTo(map)
        .bindPopup("您的精确位置")
        .openPopup();
    
    // 添加精度圆圈
    L.circle([latitude, longitude], {
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: accuracy
    }).addTo(map);
    
    // 开始监视位置变化
    watchId = navigator.geolocation.watchPosition(
        updatePosition,
        showError,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
}

// 更新用户位置
function updatePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    statusElement.textContent = `您的位置: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
    if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
    }
    
    if (map) {
        map.setView([latitude, longitude]);
    }
    
    // 更新发送到服务器的位置数据
    sendLocationToServer(latitude, longitude, accuracy, 'precise_update');
}

// 发送位置数据到服务器
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

// 处理错误
function showError(error) {
    let message;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "您拒绝了位置权限，将使用IP位置";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "位置信息不可用，使用IP位置";
            break;
        case error.TIMEOUT:
            message = "获取位置超时，使用IP位置";
            break;
        case error.UNKNOWN_ERROR:
            message = "发生未知错误，使用IP位置";
            break;
    }
    statusElement.textContent = message;
    
    if (ipBasedLocation) {
        initMapWithIPLocation();
    } else {
        initDefaultMap();
    }
}

// 清理监视器
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});
