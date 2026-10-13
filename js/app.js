/* ========================================================================
   app.js —— 主逻辑
   职责：
     1. 数据管理（todos 数组 + localStorage 同步）
     2. 增删改查、统计
     3. 渲染与 DOM 事件
     4. 主题、动画风格、音效的偏好应用
     5. 完成时的庆祝反馈编排（+1 / Combo）
   依赖：window.Storage、window.Animations、window.CloudLayout
   ====================================================================== */

(function (global) {
    "use strict";

    /* ==================================================================
       一、应用状态
       ================================================================== */
    var state = {
        todos: [],                 // {id, text, completed, createdAt}
        editingId: null,
        prefs: Storage.getPrefs()  // {theme, animType, sound}
    };

    /* ==================================================================
       二、DOM 引用
       ================================================================== */
    var dom = {
        form:           document.getElementById("todo-form"),
        input:          document.getElementById("todo-input"),
        list:           document.getElementById("todo-list"),
        emptyState:     document.getElementById("empty-state"),
        clearCompleted: document.getElementById("clear-completed"),
        // 统计
        progressBar:    document.getElementById("progress-bar"),
        completionRate: document.getElementById("completion-rate"),
        remainingCount: document.getElementById("remaining-count"),
        // 头部操作
        themeBtn:       document.getElementById("theme-btn"),
        settingsBtn:    document.getElementById("settings-btn"),
        // 设置面板
        settingsPanel:  document.getElementById("settings-panel"),
        settingsOverlay:document.getElementById("settings-overlay"),
        closeSettings:  document.getElementById("close-settings"),
        animGrid:       document.getElementById("anim-grid"),
        previewAnim:    document.getElementById("preview-anim"),
        themeOptions:   document.getElementById("theme-options"),
        soundToggle:    document.getElementById("sound-toggle"),
        resetData:      document.getElementById("reset-data"),
        markerColors:   document.getElementById("marker-colors"),
        markerColorPicker: document.getElementById("marker-color-picker"),
        themeColorPicker: document.getElementById("theme-color-picker"),
        themeColorValue: document.getElementById("theme-color-value"),
        themeColorEndPicker: document.getElementById("theme-color-end-picker"),
        themeColorEndValue: document.getElementById("theme-color-end-value"),
        customThemeControls: document.getElementById("custom-theme-controls")
    };

    /* ==================================================================
       三、工具函数
       ================================================================== */

    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(msg) {
        var toast = document.createElement("div");
        toast.className = "toast";
        toast.setAttribute("role", "status");
        toast.textContent = msg;
        document.body.appendChild(toast);
        // 触发显示
        requestAnimationFrame(function () { toast.classList.add("show"); });
        setTimeout(function () {
            toast.classList.remove("show");
            setTimeout(function () {
                if (toast.parentNode) { toast.parentNode.removeChild(toast); }
            }, 400);
        }, 1800);
    }

    /**
     * 音效：完成时播放短促上扬音
     * 用 Web Audio API 现场合成，无需音频文件
     */
    function playCompleteSound() {
        if (!state.prefs.sound) { return; }
        try {
            var AudioCtx = global.AudioContext || global.webkitAudioContext;
            if (!AudioCtx) { return; }
            var ac = new AudioCtx();
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.type = "sine";
            // 一个上扬的小三度
            osc.frequency.setValueAtTime(660, ac.currentTime);
            osc.frequency.setValueAtTime(880, ac.currentTime + 0.12);
            gain.gain.setValueAtTime(0.18, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
            osc.start();
            osc.stop(ac.currentTime + 0.3);
            osc.onended = function () { ac.close && ac.close(); };
        } catch (e) {
            /* 静默失败 */
        }
    }

    /* ==================================================================
       四、数据操作
       ================================================================== */

    function persist() {
        Storage.saveTodos(state.todos);
    }

    function addTodo(text) {
        text = text.trim();
        if (!text) { return false; }
        var todo = {
            id: genId(),
            text: text,
            completed: false,
            createdAt: Date.now()
        };
        state.todos.unshift(todo);   // 新的放最前
        persist();
        render();
        // 新增入场动画
        var node = dom.list.querySelector('[data-id="' + todo.id + '"]');
        if (node) {
            node.classList.add("entering");
            setTimeout(function () { node.classList.remove("entering"); }, 500);
        }
        return true;
    }

    function toggleTodo(id) {
        var todo = findTodo(id);
        if (!todo) { return; }
        todo.completed = !todo.completed;
        persist();

        // 关键：不重建节点，直接切换类名，让 CSS transition 稳定触发
        // （重建节点会让新节点初始即处于终态，width:0→100% 的过渡无法触发）
        var node = dom.list.querySelector('[data-id="' + id + '"]');
        if (node) {
            node.classList.toggle("completed", todo.completed);
            var strike = node.querySelector(".strike-through");
            if (strike) {
                strike.classList.toggle("active", todo.completed);
            }
            var cb = node.querySelector(".todo-text");
            if (cb) {
                cb.setAttribute("aria-checked", todo.completed);
                cb.setAttribute("aria-label", (todo.completed ? "恢复待办：" : "完成待办：") + todo.text);
            }
        }
        // 仅刷新统计（不重渲染列表）
        renderStats();

        if (todo.completed) {
            // 完成反馈：+1 飘字与音效，按当前偏好播放完成动画。
            Animations.popCombo();
            playCompleteSound();
            if (state.todos.length && state.todos.every(function (t) { return t.completed; })) {
                showToast("全部完成！今天的你很棒 ✨");
            }
        }
    }

    function deleteTodo(id) {
        var node = dom.list.querySelector('[data-id="' + id + '"]');
        if (!node) { return; }

        // 数据立即删除，视觉退场独立完成，避免重绘打断删除。
        state.todos = state.todos.filter(function (t) { return t.id !== id; });
        persist();
        renderStats();
        node.classList.add("leaving");
        setTimeout(function () {
            if (dom.list.querySelector(".todo-edit-input")) { node.remove(); }
            else { render(); }
        }, 450);
    }

    function editTodo(id, newText) {
        newText = newText.trim();
        var todo = findTodo(id);
        if (!todo) { return; }
        if (!newText) {
            // 编辑为空 → 视为删除
            deleteTodo(id);
            return;
        }
        todo.text = newText;
        persist();
        render();
    }

    function clearCompleted() {
        var has = state.todos.some(function (t) { return t.completed; });
        if (!has) {
            showToast("没有已完成的项");
            return;
        }
        var nodes = dom.list.querySelectorAll(".todo-item.completed");
        nodes.forEach(function (n) {
            n.classList.add("leaving");
        });
        state.todos = state.todos.filter(function (t) { return !t.completed; });
        persist();
        renderStats();
        setTimeout(function () {
            if (dom.list.querySelector(".todo-edit-input")) { nodes.forEach(function (n) { n.remove(); }); }
            else { render(); }
            showToast("已清除全部已完成项");
        }, 450);
    }

    function findTodo(id) {
        return state.todos.find(function (t) { return t.id === id; });
    }

    /* ==================================================================
       五、渲染
       ================================================================== */

    function render() {
        var focused = document.activeElement;
        var focusedItem = focused && focused.closest(".todo-item");
        var focusId = focusedItem && focusedItem.dataset.id;
        var focusClass = focused && focused.classList.contains("todo-text") ? ".todo-text" : ".delete-btn";
        var list = state.todos;
        // 清空
        dom.list.innerHTML = "";

        list.forEach(function (todo) {
            dom.list.appendChild(createTodoNode(todo));
        });
        CloudLayout.arrange(dom.list);

        // 空状态
        dom.emptyState.classList.toggle("hidden", list.length > 0);

        renderStats();
        if (focusId) {
            var replacement = dom.list.querySelector('[data-id="' + focusId + '"] ' + focusClass);
            (replacement || dom.input).focus();
        }
    }

    function createTodoNode(todo) {
        var li = document.createElement("li");
        li.className = "todo-item cloud-item" + (todo.completed ? " completed" : "");
        li.dataset.id = todo.id;
        var word = document.createElement("div");
        word.className = "cloud-word";
        var text = document.createElement("span");
        text.className = "todo-text";
        text.tabIndex = 0;
        text.setAttribute("role", "checkbox");
        text.setAttribute("aria-checked", todo.completed);
        text.setAttribute("aria-label", (todo.completed ? "恢复待办：" : "完成待办：") + todo.text);
        text.title = "点击完成 · 双击或 F2 编辑";
        Animations.applyAnimClass(text, state.prefs.animType);
        var wrap = document.createElement("span");
        wrap.className = "text-wrap";
        var content = document.createElement("span");
        content.className = "text";
        content.textContent = todo.text;
        var strike = document.createElement("span");
        strike.className = "strike-through" + (todo.completed ? " active" : "");
        wrap.appendChild(content);
        wrap.appendChild(strike);
        text.appendChild(wrap);
        var delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "×";
        delBtn.title = "删除任务";
        delBtn.setAttribute("aria-label", "删除待办：" + todo.text);
        word.appendChild(text);
        word.appendChild(delBtn);
        li.appendChild(word);
        var clickTimer;
        text.addEventListener("click", function (event) {
            clearTimeout(clickTimer);
            if (event.detail > 1) { return; }
            clickTimer = setTimeout(function () {
                if (li.isConnected && !document.getElementById("edit-dialog").open) { toggleTodo(todo.id); }
            }, 300);
        });
        text.addEventListener("dblclick", function (event) {
            event.preventDefault();
            clearTimeout(clickTimer);
            enterEditMode(li, todo);
        });
        text.addEventListener("keydown", function (event) {
            if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                clearTimeout(clickTimer);
                toggleTodo(todo.id);
            } else if (event.key === "F2") {
                event.preventDefault();
                enterEditMode(li, todo);
            } else if (event.key === "Delete") {
                event.preventDefault();
                deleteTodo(todo.id);
            }
        });
        delBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            clearTimeout(clickTimer);
            deleteTodo(todo.id);
        });
        return li;
    }

    function enterEditMode(li, todo) {
        state.editingId = todo.id;
        var input = document.getElementById("edit-input");
        input.value = todo.text;
        document.getElementById("edit-dialog").showModal();
        input.focus();
        input.select();
    }

    /* ---------------------- 统计渲染 ---------------------- */

    function renderStats() {
        var total = state.todos.length;
        var done = state.todos.filter(function (t) { return t.completed; }).length;
        var rate = total === 0 ? 0 : Math.round((done / total) * 100);

        dom.progressBar.style.width = rate + "%";
        dom.completionRate.textContent = rate + "%";
        dom.remainingCount.textContent = total - done;
        dom.clearCompleted.disabled = done === 0;
    }

    /* ==================================================================
       六、设置面板
       ================================================================== */

    function buildAnimGrid() {
        dom.animGrid.innerHTML = "";
        Animations.TYPES.forEach(function (t) {
            var btn = document.createElement("button");
            btn.className = "anim-option";
            btn.dataset.anim = t.id;
            if (t.id === state.prefs.animType) { btn.classList.add("active"); }
            btn.innerHTML =
                '<span class="anim-icon">' + t.icon + "</span>" +
                "<span>" + t.name + "</span>";
            btn.title = t.desc;
            btn.addEventListener("click", function () {
                setAnimType(t.id);
            });
            dom.animGrid.appendChild(btn);
        });
    }

    function setAnimType(type) {
        state.prefs.animType = type;
        Storage.savePrefs({ animType: type });
        // 更新选中态
        dom.animGrid.querySelectorAll(".anim-option").forEach(function (b) {
            b.classList.toggle("active", b.dataset.anim === type);
        });
        // 立即应用到已渲染的待办项
        dom.list.querySelectorAll(".todo-text").forEach(function (el) {
            Animations.applyAnimClass(el, type);
        });
        showToast("动画已切换：" + animName(type));
    }

    function animName(type) {
        var t = Animations.TYPES.find(function (x) { return x.id === type; });
        return t ? t.name : type;
    }

    function buildThemeOptions() {
        dom.themeOptions.querySelectorAll(".theme-option").forEach(function (b) {
            b.classList.toggle("active", b.dataset.theme === state.prefs.theme);
            b.setAttribute("aria-pressed", b.dataset.theme === state.prefs.theme);
            b.onclick = function () { setTheme(b.dataset.theme); };
        });
    }

    function setTheme(theme) {
        state.prefs.theme = theme;
        Storage.savePrefs({ theme: theme });
        document.documentElement.setAttribute("data-theme", theme);
        applyGradientTheme();
        dom.themeOptions.querySelectorAll(".theme-option").forEach(function (b) {
            b.classList.toggle("active", b.dataset.theme === theme);
        });
    }

    function applyGradientTheme() {
        var colors = state.prefs.gradientColors;
        var rgb = [1, 3, 5].map(function (offset) {
            return Math.round((parseInt(colors[0].slice(offset, offset + 2), 16) + parseInt(colors[1].slice(offset, offset + 2), 16)) / 2);
        });
        var linear = rgb.map(function (channel) {
            channel /= 255;
            return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        var luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        var foreground = luminance > 0.179 ? "0, 0, 0" : "255, 255, 255";
        var panel = rgb.map(function (channel) {
            return Math.round(channel * 0.88 + (luminance > 0.179 ? 255 : 0) * 0.12);
        });
        var style = document.documentElement.style;
        style.setProperty("--custom-bg", "rgb(" + rgb.join(", ") + ")");
        style.setProperty("--gradient-start", colors[0]);
        style.setProperty("--gradient-end", colors[1]);
        style.setProperty("--custom-fg", foreground);
        style.setProperty("--custom-panel", "rgb(" + panel.join(", ") + ")");
        dom.themeColorPicker.value = colors[0];
        dom.themeColorValue.textContent = colors[0].toUpperCase();
        dom.themeColorEndPicker.value = colors[1];
        dom.themeColorEndValue.textContent = colors[1].toUpperCase();
        dom.customThemeControls.hidden = state.prefs.theme !== "gradient";
    }

    /* ---------------------- 马克笔颜色 ---------------------- */

    var MARKER_COLORS = [
        "#10b981", "#fbbf24", "#f472b6", "#60a5fa", "#fb923c", "#ef4444"
    ];

    /**
     * 渲染马克笔色板（跟随主题 + 预置色块 + 自定义）
     */
    function buildMarkerColorOptions() {
        dom.markerColors.innerHTML = "";

        // 跟随主题（空串 = 使用主题 --success）
        var auto = document.createElement("button");
        auto.className = "color-swatch auto";
        auto.title = "跟随主题";
        auto.dataset.color = "";
        auto.setAttribute("aria-label", "马克笔颜色跟随主题");
        auto.addEventListener("click", function () { setMarkerColor(""); });
        dom.markerColors.appendChild(auto);

        // 预置色块
        MARKER_COLORS.forEach(function (c) {
            var sw = document.createElement("button");
            sw.className = "color-swatch";
            sw.style.background = c;
            sw.title = c;
            sw.dataset.color = c;
            sw.setAttribute("aria-label", "马克笔颜色 " + c);
            sw.addEventListener("click", function () { setMarkerColor(c); });
            dom.markerColors.appendChild(sw);
        });

        // 自定义：触发原生取色器
        var custom = document.createElement("button");
        custom.className = "color-swatch custom";
        custom.textContent = "+";
        custom.title = "自定义颜色";
        custom.addEventListener("click", function () {
            dom.markerColorPicker.value = state.prefs.markerColor || "#10b981";
            dom.markerColorPicker.click();
        });
        dom.markerColors.appendChild(custom);

        refreshMarkerColorState();
    }

    function setMarkerColor(color) {
        state.prefs.markerColor = color;
        Storage.savePrefs({ markerColor: color });
        applyMarkerColorVar();
        refreshMarkerColorState();
    }

    /** 将自定义颜色注入 CSS 变量（空串则移除，回退主题色） */
    function applyMarkerColorVar() {
        if (state.prefs.markerColor) {
            document.documentElement.style.setProperty("--marker-color", state.prefs.markerColor);
        } else {
            document.documentElement.style.removeProperty("--marker-color");
        }
    }

    /** 高亮当前选中的色块 */
    function refreshMarkerColorState() {
        var cur = state.prefs.markerColor || "";
        dom.markerColors.querySelectorAll(".color-swatch").forEach(function (sw) {
            var custom = sw.classList.contains("custom");
            sw.classList.toggle("active", custom ? !!cur && MARKER_COLORS.indexOf(cur) === -1 : sw.dataset.color === cur);
            sw.setAttribute("aria-pressed", sw.classList.contains("active"));
        });
    }

    function applyAllPrefs() {
        document.documentElement.setAttribute("data-theme", state.prefs.theme);
        dom.soundToggle.checked = !!state.prefs.sound;
        applyMarkerColorVar();
        applyGradientTheme();
    }

    /* ---------------------- 面板开关 ---------------------- */

    function openSettings() {
        dom.settingsPanel.inert = false;
        dom.settingsPanel.classList.add("active");
        dom.settingsOverlay.classList.add("active");
        dom.settingsPanel.setAttribute("aria-hidden", "false");
        dom.closeSettings.focus();
        dom.form.closest("main").inert = true;
        document.querySelector(".floating-tools").inert = true;
    }
    function closeSettings() {
        dom.settingsPanel.classList.remove("active");
        dom.settingsOverlay.classList.remove("active");
        dom.form.closest("main").inert = false;
        document.querySelector(".floating-tools").inert = false;
        dom.settingsBtn.focus();
        dom.settingsPanel.setAttribute("aria-hidden", "true");
        dom.settingsPanel.inert = true;
    }

    /* ==================================================================
       七、事件绑定
       ================================================================== */

    function bindEvents() {
        document.getElementById("shuffle-cloud").addEventListener("click", function () {
            CloudLayout.shuffle(dom.list);
        });
        document.getElementById("edit-form").addEventListener("submit", function (event) {
            event.preventDefault();
            var value = document.getElementById("edit-input").value.trim();
            if (!value) { document.getElementById("edit-input").focus(); return; }
            var id = state.editingId;
            document.getElementById("edit-dialog").close();
            editTodo(id, value);
        });
        document.getElementById("edit-cancel").addEventListener("click", function () {
            document.getElementById("edit-dialog").close();
        });
        document.getElementById("edit-delete").addEventListener("click", function () {
            var id = state.editingId;
            document.getElementById("edit-dialog").close();
            deleteTodo(id);
        });
        // 添加
        dom.form.addEventListener("submit", function (e) {
            e.preventDefault();
            var value = dom.input.value;
            if (!value.trim()) {
                // 空值校验：抖动反馈
                dom.input.classList.add("shake");
                setTimeout(function () { dom.input.classList.remove("shake"); }, 400);
                return;
            }
            addTodo(value);
            dom.input.value = "";
            dom.input.focus();
        });

        // 清除已完成
        dom.clearCompleted.addEventListener("click", clearCompleted);

        // 头部
        dom.themeBtn.addEventListener("click", cycleTheme);
        dom.settingsBtn.addEventListener("click", openSettings);
        dom.closeSettings.addEventListener("click", closeSettings);
        dom.settingsOverlay.addEventListener("click", closeSettings);

        // 设置面板内
        dom.previewAnim.addEventListener("click", function () {
            Animations.previewIn(dom.animGrid.parentNode, state.prefs.animType);
        });
        dom.soundToggle.addEventListener("change", function () {
            state.prefs.sound = dom.soundToggle.checked;
            Storage.savePrefs({ sound: dom.soundToggle.checked });
            if (dom.soundToggle.checked) { playCompleteSound(); }
        });
        [dom.themeColorPicker, dom.themeColorEndPicker].forEach(function (picker, index) {
            picker.addEventListener("input", function () {
                state.prefs.gradientColors[index] = picker.value;
                Storage.savePrefs({ gradientColors: state.prefs.gradientColors.slice() });
                applyGradientTheme();
            });
        });
        // 自定义取色器：实时应用颜色
        dom.markerColorPicker.addEventListener("input", function () {
            setMarkerColor(dom.markerColorPicker.value);
        });
        dom.resetData.addEventListener("click", function () {
            if (confirm("确定清空所有待办与设置吗？此操作不可恢复。")) {
                Storage.clearAll();
                state.todos = [];
                state.prefs = Storage.getPrefs();
                applyAllPrefs();
                buildAnimGrid();
                buildThemeOptions();
                buildMarkerColorOptions();
                render();
                showToast("已清空所有数据");
            }
        });

        // 键盘快捷键：Esc 关闭设置
        document.addEventListener("keydown", function (e) {
            if (e.key === "Tab" && dom.settingsPanel.classList.contains("active")) {
                var focusable = Array.from(dom.settingsPanel.querySelectorAll("button, input:not([tabindex='-1'])"));
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
            if (e.key === "Escape" && dom.settingsPanel.classList.contains("active")) {
                closeSettings();
            }
        });
    }

    /** 头部主题按钮：在三种主题间循环 */
    function cycleTheme() {
        var order = ["light", "dark", "gradient"];
        var idx = order.indexOf(state.prefs.theme);
        var next = order[(idx + 1) % order.length];
        setTheme(next);
        showToast("主题：" + ({ light: "亮色", dark: "暗色", gradient: "自定义渐变" })[next]);
    }

    /* ==================================================================
       八、初始化
       ================================================================== */

    function init() {
        // 加载数据
        state.todos = Storage.getTodos();
        state.prefs = Storage.getPrefs();
        // 演示入口仅为空列表提供示例，不覆盖已有任务。
        if (!state.todos.length && new URLSearchParams(global.location.search).get("demo") === "1") {
            state.todos = ["读一本书", "好好吃饭", "散步", "整理房间", "学点新东西", "去看日落", "给家人打电话", "喝水", "早睡", "做一顿早餐", "记录灵感", "拉伸十分钟", "听一张专辑", "浇花", "完成设计稿", "写日记", "练习英语", "买束鲜花", "清理相册", "专注二十五分钟", "骑车", "给朋友写封信", "计划周末", "留点时间给自己"].map(function (text) {
                return { id: genId(), text: text, completed: false, createdAt: Date.now() };
            });
        }

        // 兼容旧数据中的动画类型
        if (!Animations.TYPES.some(function (t) { return t.id === state.prefs.animType; })) {
            state.prefs.animType = "strike";
            Storage.savePrefs({ animType: "strike" });
        }

        applyAllPrefs();
        buildAnimGrid();
        buildThemeOptions();
        buildMarkerColorOptions();
        bindEvents();
        render();
        CloudLayout.observe(dom.list);

        if (!Storage.isAvailable()) {
            setTimeout(function () {
                showToast("⚠️ 浏览器不支持本地存储，数据刷新会丢失");
            }, 800);
        }
    }

    // DOM 就绪后启动
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})(window);
