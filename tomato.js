$(document).ready(function() {
    // ==========================================
    // 1. 變數與基礎設定
    // ==========================================
    let timer;
    let timeLeft = 25; // 測試用
    let isRunning = false;
    let currentMode = 'focus'; 
    
    // ★ 新增：追蹤目前選取的任務 ID
    let currentTaskId = null;

    let stats = JSON.parse(localStorage.getItem('pomodoroStats')) || { totalSeconds: 0, completed: 0 };
    updateStatsDisplay();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // ==========================================
    // 2. 計時器核心功能
    // ==========================================
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function updateDisplay() {
        $('.timer-display').text(formatTime(timeLeft));
    }

    $('.mode-btn').click(function() {
        clearInterval(timer);
        isRunning = false;
        toggleButtons();

        $('.mode-btn').removeClass('active');
        $(this).addClass('active');
        
        currentMode = $(this).data('mode');
        const seconds = parseInt($(this).data('time'));
        timeLeft = seconds; 
        updateDisplay();
    });

    $('#start-btn').click(function() {
        if (isRunning) return;
        
        // 檢查：如果是專注模式，建議要選一個任務 (但不是強制)
        if (currentMode === 'focus' && !currentTaskId) {
            // 可以選擇 alert 提醒，或者不強制
            // alert("建議先選擇一個任務再開始喔！");
        }

        if (timeLeft <= 0) {
            const seconds = parseInt($('.mode-btn.active').data('time'));
            timeLeft = seconds;
            updateDisplay();
        }

        isRunning = true;
        toggleButtons();
        playSound('start'); // 播放開始音效 (選擇性)

        timer = setInterval(function() {
            timeLeft--;
            updateDisplay();

            if (timeLeft <= 0) {
                clearInterval(timer);
                isRunning = false;
                timerFinished();
            }
        }, 1000);
    });

    $('#pause-btn').click(function() {
        clearInterval(timer);
        isRunning = false;
        toggleButtons();
    });

    $('#reset-btn').click(function() {
        clearInterval(timer);
        isRunning = false;
        const seconds = parseInt($('.mode-btn.active').data('time'));
        timeLeft = seconds;
        updateDisplay();
        toggleButtons();
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

    // --- 計時結束處理 ---
    function timerFinished() {
        toggleButtons(); 
        playSound('alarm'); // 播放鬧鐘聲
        
        if (currentMode === 'focus') {
            startFireworks(); 
            
            // 1. 全域統計更新
            stats.completed++;
            stats.totalSeconds += parseInt($('.mode-btn[data-mode="focus"]').data('time'));
            localStorage.setItem('pomodoroStats', JSON.stringify(stats));
            updateStatsDisplay();

            // 2. ★ 任務進度更新 (如果有選取任務)
            if (currentTaskId) {
                const taskIndex = tasks.findIndex(t => t.id === currentTaskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex].act++; // 增加該任務的完成數
                    saveTasks();
                    renderTasks(); // 重新渲染以更新進度條
                }
            }
        }

        if (Notification.permission === "granted") {
            new Notification("時間到！", { 
                body: currentMode === 'focus' ? "休息一下吧！" : "回來專注囉！"
            });
        } else {
            setTimeout(() => alert("時間到！"), 200); 
        }

        // 自動重置
        const seconds = parseInt($('.mode-btn.active').data('time'));
        timeLeft = seconds; 
        updateDisplay(); 
    }

    function updateStatsDisplay() {
        $('#total-focus-time').text(stats.totalSeconds);
        $('#completed-poms').text(stats.completed);
    }

    // 播放音效輔助函式
    function playSound(type) {
        const audio = document.getElementById('alarm-sound');
        if (type === 'alarm') {
            audio.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    // ==========================================
    // 3. 任務清單功能 (大幅升級)
    // ==========================================
    // 讀取任務，注意要處理舊資料可能沒有 est/act 欄位的問題
    let tasks = JSON.parse(localStorage.getItem('pomodoroTasks')) || [];
    
    // 資料遷移：確保舊資料有新欄位
    tasks.forEach(t => {
        if (!t.est) t.est = 1;
        if (!t.act) t.act = 0;
    });

    renderTasks();

    // 新增任務
    $('#add-task-btn').click(function() {
        const name = $('#task-name').val().trim();
        const tag = $('#task-tag').val();
        let est = parseInt($('#task-est').val());
        if(est < 1) est = 1;

        if (name) {
            // ★ 資料結構：id, name, tag, est(預估), act(實際)
            const newTask = { 
                id: Date.now(), 
                name, 
                tag, 
                est: est, 
                act: 0 
            };
            tasks.push(newTask);
            saveTasks();
            renderTasks();
            $('#task-name').val('');
            $('#task-est').val(1);
        }
    });

    // 點擊任務 -> 設定為當前任務
    $('#task-list').on('click', '.task-item', function(e) {
        // 如果點到刪除按鈕，不觸發選取
        if ($(e.target).hasClass('delete-btn')) return;

        // 取得點擊的任務 ID
        const id = $(this).data('id');
        currentTaskId = id;
        
        renderTasks(); // 重新渲染以更新選取樣式
        updateCurrentTaskDisplay();
    });

    // 刪除任務
    $('#task-list').on('click', '.delete-btn', function(e) {
        e.stopPropagation(); // 阻止事件冒泡到 li
        const id = $(this).parent().parent().data('id'); // 結構變了，要往上找兩層 (div -> li)
        
        // 如果刪除的是當前任務，清空當前任務
        if (id === currentTaskId) {
            currentTaskId = null;
            updateCurrentTaskDisplay();
        }

        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
    });

    function saveTasks() {
        localStorage.setItem('pomodoroTasks', JSON.stringify(tasks));
    }

    // 更新上方「正在進行」文字
    function updateCurrentTaskDisplay() {
        const $display = $('#current-task-label');
        if (currentTaskId) {
            const task = tasks.find(t => t.id === currentTaskId);
            if (task) {
                $display.html(`正在進行：<span class="active-tag">${task.name}</span>`);
            } else {
                currentTaskId = null;
                $display.html('<span class="placeholder">請選擇下方任務開始計時...</span>');
            }
        } else {
            $display.html('<span class="placeholder">請選擇下方任務開始計時...</span>');
        }
    }

    function renderTasks() {
        const $list = $('#task-list');
        $list.empty();
        
        tasks.forEach(task => {
            const tagLabel = getTagLabel(task.tag);
            // 計算進度百分比
            const percent = Math.min((task.act / task.est) * 100, 100); 
            // 判斷是否為選取狀態
            const activeClass = (task.id === currentTaskId) ? 'selected-task' : '';

            $list.append(`
                <li class="task-item ${activeClass}" data-id="${task.id}">
                    <div class="task-header">
                        <div>
                            <span class="task-tag tag-${task.tag}">${tagLabel}</span>
                            <span class="task-title">${task.name}</span>
                        </div>
                        <span class="delete-btn">×</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percent}%"></div>
                    </div>
                    <div class="progress-text">
                        進度: ${task.act} / ${task.est} 番茄
                    </div>
                </li>
            `);
        });
    }

    function getTagLabel(tag) {
        const map = { 'coding': '程式', 'study': '讀書', 'meeting': '會議', 'exercise': '運動' };
        return map[tag] || tag;
    }

    // ==========================================
    // 4. 煙火系統
    // ==========================================
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.alpha = 1; 
            this.decay = Math.random() * 0.02 + 0.01; 
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.05; 
            this.alpha -= this.decay;
        }
    }

    function startFireworks() {
        createExplosion();
        for(let i=1; i<5; i++) {
            setTimeout(() => createExplosion(), i * 300);
        }
        animateFireworks();
    }

    function createExplosion() {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height / 2; 
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(x, y, color));
        }
    }

    function animateFireworks() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.alpha <= 0) particles.splice(index, 1);
        });
        if (particles.length > 0) {
            requestAnimationFrame(animateFireworks);
        }
    }
});