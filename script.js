// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const viewUpload = document.getElementById('upload-view');
const viewScan = document.getElementById('scan-view');
const viewResult = document.getElementById('result-view');
const scannedImage = document.getElementById('scanned-image');
const resultImage = document.getElementById('result-image');
const scanProgress = document.getElementById('scan-progress');
const terminalLogs = document.getElementById('terminal-logs');
const resetBtn = document.getElementById('reset-btn');

// View Switcher
function switchView(viewToShow) {
    [viewUpload, viewScan, viewResult].forEach(view => {
        view.classList.remove('section-active');
        view.classList.add('section-hidden');
    });
    
    // Give a slight delay for smooth transition
    setTimeout(() => {
        viewToShow.classList.remove('section-hidden');
        viewToShow.classList.add('section-active');
    }, 100);
}

// Handle File Select
function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('請上傳有效的圖片檔案。');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imgSrc = e.target.result;
        scannedImage.src = imgSrc;
        resultImage.src = imgSrc;
        
        switchView(viewScan);
        startScanningSimulation(document.getElementById('scanned-image'));
    };
    reader.readAsDataURL(file);
}

// Drag & Drop Listeners
dropZone.addEventListener('click', () => {
    if (dropZone.classList.contains('disabled')) return;
    fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropZone.classList.contains('disabled')) return;
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropZone.classList.contains('disabled')) return;
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Reset logic
resetBtn.addEventListener('click', () => {
    fileInput.value = '';
    scannedImage.src = '';
    resultImage.src = '';
    scanProgress.style.width = '0%';
    terminalLogs.innerHTML = '<p>> 等待上傳...</p>';
    switchView(viewUpload);
});

// --- AI Model Loading & Logic ---
let modelsLoaded = false;
const dropHint = document.querySelector('.drop-hint');

async function loadModels() {
    dropHint.innerText = "正在載入天地演算模型，請稍候...";
    dropZone.classList.add('disabled');
    dropZone.style.opacity = '0.5';
    dropZone.style.cursor = 'wait';

    try {
        // Use jsdelivr CDN instead of './models' to avoid CORS issues when opening index.html directly from file://
        const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        modelsLoaded = true;
        dropHint.innerText = "系統已就緒。支援 JPG, PNG, WEBP";
        dropZone.classList.remove('disabled');
        dropZone.style.opacity = '1';
        dropZone.style.cursor = 'pointer';
        console.log("Models loaded successfully from CDN.");
    } catch (err) {
        console.error("Error loading models", err);
        dropHint.innerText = "模型載入失敗，請確認網路連線是否正常。";
    }
}

// Start models preloading on start
window.addEventListener('DOMContentLoaded', loadModels);


// Simulation Logic combined with Real tracking
const logs = [
    '> 載入五官特徵模型...',
    '> 正在提取面部關鍵點 [68/68]',
    '> 分析骨相結構與肉相特徵...',
    '> 對比《神相全編》易理資料庫...',
    '> 結合排印八字流年命盤...',
    '> 運算完成。正在生成報告...'
];

async function startScanningSimulation(imgElement) {
    let progress = 0;
    let logIndex = 0;
    scanProgress.style.width = '0%';
    terminalLogs.innerHTML = '';

    // First, start visual progress bar
    const interval = setInterval(() => {
        progress += Math.random() * 8; // Slower progress until real AI finishes
        if (progress >= 85) progress = 85; 
        
        scanProgress.style.width = `${progress}%`;

        const expectedLogIndex = Math.floor((progress / 100) * logs.length);
        if (expectedLogIndex > logIndex && logIndex < logs.length - 1) { // Save last log for complete
            terminalLogs.innerHTML += `<p>${logs[logIndex]}</p>`;
            terminalLogs.scrollTop = terminalLogs.scrollHeight;
            logIndex++;
        }
    }, 400);

    try {
        // Run Real Face-API detection with stricter options
        // We use SSDMobilenetv1Options to set a higher minConfidence (default is 0.5)
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 });
        const detections = await faceapi.detectAllFaces(imgElement, options).withFaceLandmarks();
        clearInterval(interval);
        
        scanProgress.style.width = `100%`;

        if (detections.length === 1) {
            terminalLogs.innerHTML += `<p>> 找到 1 張面孔。正在解析關鍵特徵...</p>`;
            terminalLogs.innerHTML += `<p>${logs[logs.length-1]}</p>`;
            terminalLogs.scrollTop = terminalLogs.scrollHeight;
            
            // Wait a moment for switchView to render the #result-image properly so it has physical dimensions
            setTimeout(() => {
                switchView(viewResult);
                
                // Overlay Canvas Visualization
                const displaySize = { width: resultImage.width, height: resultImage.height };
                const canvas = document.getElementById('face-canvas');
                faceapi.matchDimensions(canvas, displaySize);
                
                // Resize the detections to match the rendered image size in the DOM
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                
                // Draw simply the landmarks to show proof of work with custom styling
                const drawOptions = {
                    drawLines: true,
                    lineWidth: 1,
                    color: '#00f0ff' // Mystical cyan
                };
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections, drawOptions);
                
                // Process the algorithm based on the raw landmarks
                processRealLandmarks(detections[0].landmarks);
            }, 800);
            
        } else if (detections.length > 1) {
            // Reject if multiple people
            terminalLogs.innerHTML += `<p style="color:#ffcc00;">> 警告：偵測到 ${detections.length} 位人物。請上傳單人照片。</p>`;
            terminalLogs.scrollTop = terminalLogs.scrollHeight;
            
            setTimeout(() => {
                alert(`系統偵測到 ${detections.length} 張臉部。本命理分析系統僅支援單人面相解析，請裁剪或重新上傳清晰的「單人正面照片」。`);
                switchView(viewUpload);
            }, 1000);

        } else {
            // Reject if no face is detected
            terminalLogs.innerHTML += `<p style="color:#ff4d4d;">> 錯誤：無法在圖片中偵測到清晰的人臉特徵。</p>`;
            terminalLogs.scrollTop = terminalLogs.scrollHeight;
            
            setTimeout(() => {
                alert("AI 系統無法在此圖片中辨識到清晰的面孔。請確定照片中包含清晰的人臉，然後重新上傳。");
                switchView(viewUpload);
            }, 1000);
        }

    } catch (err) {
        clearInterval(interval);
        console.error(err);
        terminalLogs.innerHTML += `<p style="color:#ff4d4d;">> 分析中斷：辨識模組發生未知的系統錯誤。</p>`;
        setTimeout(() => {
            switchView(viewUpload);
            alert("系統運算時發生錯誤，請稍後重試或更換照片。");
        }, 1500);
    }
}

// --- Face Reading Algorithms based on Euclidean Distances ---
function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function processRealLandmarks(landmarks) {
    const pts = landmarks.positions;
    
    // 1. Face general proportions (width vs height)
    const faceWidth = getDist(pts[0], pts[16]);
    const faceHeight = getDist(pts[8], {x: pts[8].x, y: pts[27].y - getDist(pts[27], pts[8]) * 0.5 }); // Estimate top of head
    
    // 2. Eye spacing (Index 39 inner right eye, Index 42 inner left eye)
    const eyeSpacing = getDist(pts[39], pts[42]);
    const eyeRatio = eyeSpacing / faceWidth; 
    
    // 3. Nose Width (Index 31 to 35)
    const noseWidth = getDist(pts[31], pts[35]);
    const noseRatio = noseWidth / faceWidth;

    // 4. Jawline width (Angle approximation index 4 to 12)
    const jawWidth = getDist(pts[4], pts[12]);
    const jawRatio = jawWidth / faceWidth;

    // 5. Mouth width (Index 48 to 54)
    const mouthWidth = getDist(pts[48], pts[54]);
    const mouthRatio = mouthWidth / faceWidth;

    // --- Deterministic Algorithmic Translation to Bazi & Scores ---
    
    // Base Score: Start at 80, alter based on symmetry and classical ideal proportions
    let score = 80;
    
    // "Golden Ratio" logic for face height vs width (ideal approx 1.6)
    let ratio = faceHeight / faceWidth;
    if (ratio > 1.5 && ratio < 1.7) score += 5;
    else if (ratio <= 1.5) score += 2; // wider faces

    // Wide jawline (Earth/Metal element, sturdy)
    if (jawRatio > 0.8) score += 4;
    
    // Nose width (Wealth Palace in physiognomy - wider fleshy noses better)
    if (noseRatio > 0.22) score += 4;
    else score -= 2;

    score = Math.floor(Math.min(max=99, Math.max(min=65, score)));
    document.getElementById('total-score').innerText = score;

    // Element Assignment (Five Elements Strategy based on geometry)
    const elements = document.querySelectorAll('.element-tag');
    elements.forEach(e => e.classList.remove('active'));

    let traits = [];
    if (jawRatio > 0.85) { 
        traits.push("土"); // Earth: Square jaw
        document.querySelector('.element-tag.earth').classList.add('active');
    }
    if (ratio > 1.65) {
        traits.push("木"); // Wood: Long face
        document.querySelector('.element-tag.wood').classList.add('active');
    }
    if (noseRatio > 0.23) {
        traits.push("金"); // Metal: Prominent nose
        document.querySelector('.element-tag.metal').classList.add('active');
    }
    if (eyeRatio > 0.25) {
        traits.push("水"); // Water: Wide eyes, intuition
        document.querySelector('.element-tag.water').classList.add('active');
    }
    if (traits.length === 0) {
        traits.push("火"); // Default to Fire if sharp features aren't strongly met
        document.querySelector('.element-tag.fire').classList.add('active');
    }

    // Set Bazi Summary deterministically based on Elements
    const summaries = {
        "土": "面龐方正，土星當局。為人踏實穩健，具備強大包容力與信用品格。晚運極佳。",
        "木": "面形瘦長，木氣逢生。具有極高學習力與仁慈心計，適合從事企劃與教職。",
        "金": "鼻樑高挺，金水相生。性格剛毅果決，財帛宮明亮，投資理財有獨到眼光。",
        "水": "眼界開闊，水秀清明。靈動力強，適應環境能力極佳，容易得異性貴人相助。",
        "火": "五官立體，火明炎上。企圖心旺盛，充滿熱情與領導力，早年即現成名之相。"
    };
    const finalSummary = summaries[traits[0]] || summaries["金"];
    document.querySelector('.bazi-summary').innerText = finalSummary;

    // Update Bar charts deterministically
    updateBarChart('三庭', Math.min(100, 70 + (ratio * 10)));
    updateBarChart('五嶽', Math.min(100, 75 + (jawRatio * 15)));
    updateBarChart('雙目', Math.min(100, 65 + (eyeRatio * 100)));
    updateBarChart('財帛', Math.min(100, 60 + (noseRatio * 150)));
    updateBarChart('印堂', Math.min(100, 70 + (eyeRatio * 80)));
    
    // Send Data to Google Backend API
    postToGoogleBackend(score, traits[0] || "金", finalSummary);
}

function postToGoogleBackend(score, element, baziSummary) {
    // API Web App URL generated by User
    const backendUrl = "https://script.google.com/macros/s/AKfycbyLOM2dFcL5MyR27tCdDyWmASXl4dkzcWSRjJm02lfoFJMvBXWjGKelr1Apn20-j7li/exec";
    
    // We already stored the base64 image string in the DOM element
    const rawImageBase64 = document.getElementById('scanned-image').src;
    
    const payload = {
        score: score,
        element: element,
        baziSummary: baziSummary,
        image: rawImageBase64
    };

    fetch(backendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8', // Bypass preflight strictness in some cases for Google Apps Script
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        console.log('成功儲存至後台資料庫:', data);
    })
    .catch(error => {
        console.error('儲存至後台資料庫時發生錯誤:', error);
    });
}

function processFallback() {
    // Fallback pseudo-random for non-human images if API fails to detect but we force continue
    document.getElementById('total-score').innerText = Math.floor(Math.random() * 10) + 75; 
    document.querySelector('.bazi-summary').innerText = "面相特徵難以完全解析，氣場混沌之中隱藏玄機。";
}

function updateBarChart(name, percent) {
    const rows = document.querySelectorAll('.stat-row');
    rows.forEach(row => {
        if (row.querySelector('.stat-name').innerText === name) {
            row.querySelector('.stat-fill').style.width = `${percent}%`;
            let val = '平';
            if (percent > 90) val = '上吉';
            else if (percent > 80) val = '大吉';
            else if (percent > 70) val = '吉';
            row.querySelector('.stat-val').innerText = val;
        }
    });
}


// Modal Logic
const referenceModal = document.getElementById('reference-modal');
const openReferencesBtn = document.getElementById('open-references');
const closeModalBtn = document.getElementById('close-modal');

if (openReferencesBtn) {
    openReferencesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        referenceModal.classList.remove('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        referenceModal.classList.add('hidden');
    });
}

if (referenceModal) {
    referenceModal.addEventListener('click', (e) => {
        if (e.target === referenceModal) {
            referenceModal.classList.add('hidden');
        }
    });
}
