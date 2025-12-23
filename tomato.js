$(document).ready(function() {
    // 1. 變數與基礎設置
    let timer;
    let timeLeft = 25; 
    let isRunning = false;
    let currentMode = 'focus'; 
    let currentTaskId = null;

    let stats = JSON.parse(localStorage.getItem('pomodoroStats')) || { totalSeconds: 0, completed: 0 };
    updateStatsDisplay();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // 2. 白噪音控制
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
    
    // 3. 考試倒數功能
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
            const dayText = diffDays === 0 ? '今天!' : `${diffDays} 天`;

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

    // ==========================================
    // 4. 計時器核心功能
    // ==========================================
    
    // 輔助函式：切換專注模式外觀
    function toggleFocusTheme(active) {
        if (active && currentMode === 'focus') {
            $('body').addClass('focus-mode');
        } else {
            $('body').removeClass('focus-mode');
        }
    }

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
        toggleFocusTheme(false); // 切換模式時取消變色

        $('.mode-btn').removeClass('active');
        $(this).addClass('active');
        
        currentMode = $(this).data('mode');
        const seconds = parseInt($(this).data('time'));
        timeLeft = seconds; 
        updateDisplay();
    });

    $('#start-btn').click(function() {
        if (isRunning) return;
        
        if (timeLeft <= 0) {
            const seconds = parseInt($('.mode-btn.active').data('time'));
            timeLeft = seconds;
            updateDisplay();
        }

        isRunning = true;
        toggleButtons();
        toggleFocusTheme(true); 
        playSound('start'); 

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
        toggleFocusTheme(false); 
    });

    $('#reset-btn').click(function() {
        clearInterval(timer);
        isRunning = false;
        const seconds = parseInt($('.mode-btn.active').data('time'));
        timeLeft = seconds;
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

    function timerFinished() {
        toggleButtons(); 
        toggleFocusTheme(false);
        playSound('alarm');
        
        if (currentMode === 'focus') {
            startFireworks(); 
            
            stats.completed++;
            stats.totalSeconds += parseInt($('.mode-btn[data-mode="focus"]').data('time'));
            localStorage.setItem('pomodoroStats', JSON.stringify(stats));
            updateStatsDisplay();

            if (currentTaskId) {
                const taskIndex = tasks.findIndex(t => t.id === currentTaskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex].act++;
                    saveTasks();
                    renderTasks();
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

        const seconds = parseInt($('.mode-btn.active').data('time'));
        timeLeft = seconds; 
        updateDisplay(); 
    }

    function updateStatsDisplay() {
        $('#total-focus-time').text(stats.totalSeconds);
        $('#completed-poms').text(stats.completed);
    }

    function playSound(type) {
        const audio = document.getElementById('alarm-sound');
        if (type === 'alarm') {
            audio.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    
    // 5. 任務清單功能
    let tasks = JSON.parse(localStorage.getItem('pomodoroTasks')) || [];
    tasks.forEach(t => {
        if (!t.est) t.est = 1;
        if (!t.act) t.act = 0;
    });
    renderTasks();

    $('#add-task-btn').click(function() {
        const name = $('#task-name').val().trim();
        const tag = $('#task-tag').val();
        let est = parseInt($('#task-est').val());
        if(est < 1) est = 1;

        if (name) {
            const newTask = { id: Date.now(), name, tag, est: est, act: 0 };
            tasks.push(newTask);
            saveTasks();
            renderTasks();
            $('#task-name').val('');
            $('#task-est').val(1);
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
    });

    function saveTasks() {
        localStorage.setItem('pomodoroTasks', JSON.stringify(tasks));
    }

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
            const percent = Math.min((task.act / task.est) * 100, 100); 
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

    
    // 6. 煙火系統
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

