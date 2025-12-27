$(document).ready(function() {
    // 變數與基礎設定
    let timer;
    let elapsedTime = 0; 
    let isRunning = false;
    let currentMode = 'focus'; 
    let currentTaskId = null;
    
    // 圖表
    let barChart = null;
    let pieChart = null;

    let stats = JSON.parse(localStorage.getItem('pomodoroStats')) || { totalSeconds: 0 };
    updateStatsDisplay();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // 白噪音控制
    $('.sound-btn').click(function() {
        const soundType = $(this).data('sound');
        const audioElement = document.getElementById(`bgm-${soundType}`);
        
        $('audio[id^="bgm-"]').each(function() {
            if (this !== audioElement) {
                this.pause();
                this.currentTime = 0; 
            }
        });

        $('.sound-btn').removeClass('playing');
        
        if (audioElement.paused) {
            audioElement.play();
            $(this).addClass('playing');
        } else {
            audioElement.pause();
        }
    });

    $('#stop-sound-btn').click(function() {
        $('audio[id^="bgm-"]').each(function() {
            this.pause();
            this.currentTime = 0;
        });
        $('.sound-btn').removeClass('playing');
    });

    // 考試倒數功能
    let exams = JSON.parse(localStorage.getItem('examData')) || [];
    renderExams();

    $('#add-exam-btn').click(function() {
        const name = $('#exam-name').val().trim();
        const date = $('#exam-date').val();
        if (name && date) {
            exams.push({ id: Date.now(), name, date });
            saveExams();
            renderExams();
            $('#exam-name').val('');
            $('#exam-date').val('');
        }
    });
    
    $('#exam-list').on('click', '.delete-btn', function() {
        const id = $(this).closest('.exam-item').data('id');
        exams = exams.filter(e => e.id !== id);
        saveExams();
        renderExams();
    });

    function saveExams() {
        localStorage.setItem('examData', JSON.stringify(exams));
    }

    function renderExams() {
        const $list = $('#exam-list');
        $list.empty();
        
        exams.sort((a, b) => new Date(a.date) - new Date(b.date));
        const today = new Date();
        today.setHours(0,0,0,0); 

        exams.forEach(exam => {
            const examDate = new Date(exam.date);
            const diffTime = examDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return; 

            const isUrgent = diffDays <= 3 ? 'urgent' : '';
            const dayText = diffDays === 1 ? '今天!' : `${diffDays} 天`;

            $list.append(`
                <li class="exam-item ${isUrgent}" data-id="${exam.id}">
                    <div class="exam-info">
                        <span class="exam-name">${exam.name}</span>
                        <span class="exam-date">${exam.date}</span>
                    </div>
                    <div>
                        <span class="exam-days">${dayText}</span>
                        <span class="delete-btn" style="margin-left:10px;">×</span>
                    </div>
                </li>
            `);
        });
    }

    // 計時器核心功能
    function toggleFocusTheme(active) {
        if (active && currentMode === 'focus') {
            $('body').addClass('focus-mode');
        } else {
            $('body').removeClass('focus-mode');
        }
    }

    function formatTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function updateDisplay() {
        $('.timer-display').text(formatTime(elapsedTime));
    }

    // 檢查是否觸發煙火 (超過5分鐘=300秒)
    function checkAndFireFireworks() {
        if (currentMode === 'focus' && elapsedTime > 300) {
            startFireworks();
        }
    }

    $('.mode-btn').click(function() {
        // 切換模式前，先檢查是否要放煙火
        checkAndFireFireworks();

        clearInterval(timer);
        isRunning = false;
        toggleButtons();
        toggleFocusTheme(false); 

        $('.mode-btn').removeClass('active');
        $(this).addClass('active');
        
        currentMode = $(this).data('mode');
        elapsedTime = 0; 
        updateDisplay();
    });

    $('#start-btn').click(function() {
        if (isRunning) return;
        
        isRunning = true;
        toggleButtons();
        toggleFocusTheme(true); 
        if(currentMode === 'focus') playSound('start'); 

        timer = setInterval(function() {
            elapsedTime++; 
            updateDisplay();

            if (currentMode === 'focus') {
                stats.totalSeconds++;
                localStorage.setItem('pomodoroStats', JSON.stringify(stats));
                updateStatsDisplay();

                if (currentTaskId) {
                    const taskIndex = tasks.findIndex(t => t.id === currentTaskId);
                    if (taskIndex !== -1) {
                        tasks[taskIndex].act++; 
                        saveTasks();
                        renderTasks(); 
                        
                        if (stats.totalSeconds % 5 === 0) {
                            updateCharts(); 
                        }
                    }
                }
            }
        }, 1000);
    });

    $('#pause-btn').click(function() {
        // 暫停時，如果時間夠長，放煙火鼓勵
        checkAndFireFireworks();

        clearInterval(timer);
        isRunning = false;
        toggleButtons();
        toggleFocusTheme(false); 
        updateCharts(); 
    });

    $('#reset-btn').click(function() {
        clearInterval(timer);
        isRunning = false;
        elapsedTime = 0;
        updateDisplay();
        toggleButtons();
        toggleFocusTheme(false); 
    });

    function toggleButtons() {
        if (isRunning) {
            $('#start-btn').hide();
            $('#pause-btn').show();
        } else {
            $('#start-btn').show();
            $('#pause-btn').hide();
        }
    }

    function formatTotalTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}小時 ${m}分鐘`;
    }

    function updateStatsDisplay() {
        $('#total-focus-time-display').text(formatTotalTime(stats.totalSeconds));
    }

    function playSound(type) {
        const audio = document.getElementById('alarm-sound');
        if (type === 'alarm' && audio) {
            audio.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    // 任務清單與標籤管理功能
    let tasks = JSON.parse(localStorage.getItem('pomodoroTasks')) || [];
    let availableTags = JSON.parse(localStorage.getItem('pomodoroTags')) || ['程式', '讀書', '會議', '運動'];
    
    tasks.forEach(t => {
        if (!t.act) t.act = 0;
        if (!t.est) t.est = 30; 
    });

    renderTagOptions(); 
    renderTasks();
    updateCharts(); 

    function renderTagOptions() {
        const $datalist = $('#tag-options');
        $datalist.empty();
        availableTags.forEach(tag => {
            $datalist.append(`<option value="${tag}">`);
        });
    }

    $('#toggle-tag-mgr-btn').click(function() {
        $('#tag-management-area').slideToggle();
        renderTagManager(); 
    });

    function renderTagManager() {
        const $container = $('#tag-chips-container');
        $container.empty();
        if (availableTags.length === 0) {
            $container.html('<span style="font-size:0.8rem; color:#999;">目前沒有儲存的標籤</span>');
            return;
        }
        availableTags.forEach(tag => {
            const color = getColorForTag(tag);
            $container.append(`
                <div class="deletable-tag" data-tag="${tag}" style="background-color: ${color}" title="刪除 ${tag}">
                    ${tag} <i class="fas fa-times"></i>
                </div>
            `);
        });
    }

    $('#tag-chips-container').on('click', '.deletable-tag', function() {
        const tagToDelete = $(this).data('tag');
        if (confirm(`確定要從選單中刪除「${tagToDelete}」標籤嗎？`)) {
            availableTags = availableTags.filter(t => t !== tagToDelete);
            localStorage.setItem('pomodoroTags', JSON.stringify(availableTags));
            renderTagOptions();   
            renderTagManager();   
        }
    });

    $('#add-task-btn').click(function() {
        const name = $('#task-name').val().trim();
        const tagName = $('#task-tag-input').val().trim(); 
        
        // 讀取兩個輸入框並計算總分鐘
        let estH = parseInt($('#task-est-h').val());
        let estM = parseInt($('#task-est-m').val());
        
        if (isNaN(estH) || estH < 0) estH = 0;
        if (isNaN(estM) || estM < 0) estM = 0;
        
        let totalEstMinutes = (estH * 60) + estM;
        if(totalEstMinutes < 1) totalEstMinutes = 30; // 預設至少30分鐘

        if (name && tagName) {
            if (!availableTags.includes(tagName)) {
                availableTags.push(tagName);
                localStorage.setItem('pomodoroTags', JSON.stringify(availableTags));
                renderTagOptions(); 
                if($('#tag-management-area').is(':visible')) renderTagManager();
            }
            
            const newTask = { id: Date.now(), name, tag: tagName, est: totalEstMinutes, act: 0 };
            tasks.push(newTask);
            saveTasks();
            renderTasks();
            updateCharts();
            
            $('#task-name').val('');
            $('#task-tag-input').val('');
            $('#task-est-h').val(0);
            $('#task-est-m').val(30);
        } else {
            alert('請輸入任務名稱與選擇科目！');
        }
    });

    $('#task-list').on('click', '.task-item', function(e) {
        if ($(e.target).hasClass('delete-btn')) return;
        const id = $(this).data('id');
        currentTaskId = id;
        renderTasks(); 
        updateCurrentTaskDisplay();
    });

    $('#task-list').on('click', '.delete-btn', function(e) {
        e.stopPropagation();
        const id = $(this).parent().parent().data('id'); 
        if (id === currentTaskId) {
            currentTaskId = null;
            updateCurrentTaskDisplay();
        }
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        updateCharts();
    });

    function saveTasks() {
        localStorage.setItem('pomodoroTasks', JSON.stringify(tasks));
    }

    function updateCurrentTaskDisplay() {
        const $display = $('#current-task-label');
        if (currentTaskId) {
            const task = tasks.find(t => t.id === currentTaskId);
            if (task) {
                const tagColor = getColorForTag(task.tag);
                $display.html(`正在進行：<span class="active-tag" style="color:${tagColor}">${task.name}</span>`);
            } else {
                currentTaskId = null;
                $display.html('<span class="placeholder">請選擇右側任務開始計時...</span>');
            }
        } else {
            $display.html('<span class="placeholder">請選擇右側任務開始計時...</span>');
        }
    }

    function getColorForTag(str) {
        const palette = ['#5bc0de', '#f0ad4e', '#d9534f', '#5cb85c', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
        return palette[hash % palette.length];
    }

    function renderTasks() {
        const $list = $('#task-list');
        $list.empty();
        tasks.forEach(task => {
            const actMinutes = (task.act / 60).toFixed(1); 
            const percent = Math.min((task.act / (task.est * 60)) * 100, 100); 
            
            // 格式化預估時間顯示 (X小時 Y分鐘)
            const estH = Math.floor(task.est / 60);
            const estM = task.est % 60;
            let estDisplay = "";
            if(estH > 0) estDisplay += `${estH}小時 `;
            estDisplay += `${estM}分鐘`;

            const activeClass = (task.id === currentTaskId) ? 'selected-task' : '';
            const tagColor = getColorForTag(task.tag);
            
            $list.append(`
                <li class="task-item ${activeClass}" data-id="${task.id}">
                    <div class="task-header">
                        <div>
                            <span class="task-tag" style="background-color: ${tagColor}">${task.tag}</span>
                            <span class="task-title">${task.name}</span>
                        </div>
                        <span class="delete-btn">×</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percent}%"></div>
                    </div>
                    <div class="progress-text">進度: ${actMinutes}分 / ${estDisplay}</div>
                </li>
            `);
        });
    }

    function updateCharts() { // 統計圖表更新
        const tagStats = {};
        availableTags.forEach(tag => { tagStats[tag] = 0; });

        tasks.forEach(task => {
            if (tagStats[task.tag] === undefined) tagStats[task.tag] = 0;
            tagStats[task.tag] += task.act; 
        });

        const labels = Object.keys(tagStats);
        const data = Object.values(tagStats).map(sec => (sec / 60).toFixed(1)); 
        const colors = labels.map(tag => getColorForTag(tag));

        const barCtx = document.getElementById('barChart').getContext('2d');
        if (barChart) barChart.destroy();
        
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '專注時間 (分鐘)',
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });

        const pieCtx = document.getElementById('pieChart').getContext('2d');
        if (pieChart) pieChart.destroy();

        const nonZeroLabels = [];
        const nonZeroData = [];
        const nonZeroColors = [];

        labels.forEach((label, index) => {
            if (data[index] > 0) {
                nonZeroLabels.push(label);
                nonZeroData.push(data[index]);
                nonZeroColors.push(colors[index]);
            }
        });

        if (nonZeroData.length === 0) {
            pieChart = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: ['尚未開始'],
                    datasets: [{ data: [1], backgroundColor: ['#eee'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
            });
        } else {
            pieChart = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: nonZeroLabels,
                    datasets: [{
                        data: nonZeroData,
                        backgroundColor: nonZeroColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } }
                    }
                }
            });
        }
    }

    // 煙火系統
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    let particles = []; 
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    class Particle {
        constructor(x, y, color) {
            this.x = x; this.y = y; this.color = color;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
            this.alpha = 1; this.decay = Math.random() * 0.02 + 0.01; 
        }
        draw() {
            ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        update() { this.x += this.vx; this.y += this.vy; this.vy += 0.05; this.alpha -= this.decay; }
    }
    window.startFireworks = function() {
        createExplosion();
        for(let i=1; i<5; i++) setTimeout(() => createExplosion(), i * 300);
        animateFireworks();
    }
    function createExplosion() {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height / 2; 
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        for (let i = 0; i < 50; i++) particles.push(new Particle(x, y, color));
    }
    function animateFireworks() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, index) => { p.update(); p.draw(); if (p.alpha <= 0) particles.splice(index, 1); });
        if (particles.length > 0) requestAnimationFrame(animateFireworks);
    }
});
