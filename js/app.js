/* ========================================================================
   app.js —— 主逻辑
   职责：
     1. 数据管理（todos 数组 + localStorage 同步）
     2. 增删改查、筛选、统计
     3. 渲染与 DOM 事件
     4. 主题、动画风格、音效的偏好应用
     5. 完成时的庆祝反馈编排（+1 / 礼花 / Combo）
   依赖：window.Storage、window.Animations
   ====================================================================== */

(function (global) {
    "use strict";

    /* ==================================================================
       一、应用状态
       ================================================================== */
    var state = {
        todos: [],                 // {id, text, completed, createdAt}
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
        markerColorPicker: document.getElementById("marker-color-picker")
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
            var cb = node.querySelector(".todo-checkbox");
            if (cb) { cb.setAttribute("aria-checked", todo.completed); }
        }
        // 仅刷新统计（不重渲染列表）
        renderStats();

        if (todo.completed) {
            // 完成反馈：+1 飘字 + 音效；云朵动画额外飘出云朵点缀（文字保留）
            Animations.popCombo();
            playCompleteSound();
            if (state.prefs.animType === "cloud" && node) {
                Animations.cloudPuffsAt(node);
            }
        }
    }

    function deleteTodo(id) {
        var node = dom.list.querySelector('[data-id="' + id + '"]');
        if (!node) { return; }

        // 先播退场动画，动画结束再删数据
        node.classList.add("leaving");
        node.addEventListener("animationend", function handler() {
            node.removeEventListener("animationend", handler);
            state.todos = state.todos.filter(function (t) { return t.id !== id; });
            persist();
            render();
        });
        // 兜底：动画异常时 600ms 后强制移除
        setTimeout(function () {
            if (node.parentNode) {
                state.todos = state.todos.filter(function (t) { return t.id !== id; });
                persist();
                render();
            }
        }, 600);
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
        // 给所有已完成项加退场动画
        var nodes = dom.list.querySelectorAll(".todo-item.completed");
        nodes.forEach(function (n) { n.classList.add("leaving"); });

        setTimeout(function () {
            state.todos = state.todos.filter(function (t) { return !t.completed; });
            persist();
            render();
            showToast("已清除全部已完成项");
        }, 450);
    }

    function findTodo(id) {
        return state.todos.find(function (t) { return t.id === id; });
    }

    /* ==================================================================
       五、渲染
       ================================================================== */

    function getFiltered() {
        // 仅展示全部状态（筛选 tab 已移除）
        return state.todos.slice();
    }

    function render() {
        var list = getFiltered();
        // 清空
        dom.list.innerHTML = "";

        list.forEach(function (todo) {
            dom.list.appendChild(createTodoNode(todo));
        });

        // 空状态
        dom.emptyState.classList.toggle("hidden", list.length > 0);

        renderStats();
    }

    function createTodoNode(todo) {
        var li = document.createElement("li");
        li.className = "todo-item" + (todo.completed ? " completed" : "");
        li.dataset.id = todo.id;

        // 复选框
        var checkbox = document.createElement("div");
        checkbox.className = "todo-checkbox";
        checkbox.setAttribute("role", "checkbox");
        checkbox.setAttribute("aria-checked", todo.completed);
        checkbox.title = "标记完成";

        // 文本（承载划掉动画类）—— 用 text-wrap 包裹，
        // 内部含 .text（文字）和 .strike-through（独立删除线 span，仿案例）
        var text = document.createElement("span");
        text.className = "todo-text";
        Animations.applyAnimClass(text, state.prefs.animType);

        var textWrap = document.createElement("span");
        textWrap.className = "text-wrap";

        var textInner = document.createElement("span");
        textInner.className = "text";
        textInner.textContent = todo.text;

        // 独立的删除线 span（仿 Samantha Ming 案例）
        var strike = document.createElement("span");
        strike.className = "strike-through" + (todo.completed ? " active" : "");

        textWrap.appendChild(textInner);
        textWrap.appendChild(strike);
        text.appendChild(textWrap);

        // 删除按钮
        var delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.innerHTML = "&times;";
        delBtn.title = "删除";
        delBtn.setAttribute("aria-label", "删除该待办");

        li.appendChild(checkbox);
        li.appendChild(text);
        li.appendChild(delBtn);

        // ---- 事件 ----
        // 完成切换：点击复选框 或 文字
        checkbox.addEventListener("click", function () {
            toggleTodo(todo.id);
        });
        text.addEventListener("click", function (e) {
            // 编辑模式下不触发完成
            if (li.querySelector(".todo-edit-input")) { return; }
            toggleTodo(todo.id);
        });
        // 删除
        delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteTodo(todo.id);
        });
        // 双击文字 → 编辑
        text.addEventListener("dblclick", function (e) {
            e.stopPropagation();
            enterEditMode(li, todo);
        });

        return li;
    }

    function enterEditMode(li, todo) {
        var todoText = li.querySelector(".todo-text");
        var oldWrap = li.querySelector(".text-wrap");
        if (!todoText || !oldWrap || li.querySelector(".todo-edit-input")) { return; }

        var input = document.createElement("input");
        input.className = "todo-edit-input";
        input.type = "text";
        input.value = todo.text;
        input.maxLength = 120;

        // 替换 text-wrap（保留 .todo-text 这个动画类容器）
        todoText.replaceChild(input, oldWrap);
        input.focus();
        // 光标移到末尾
        var len = input.value.length;
        input.setSelectionRange(len, len);

        function save() {
            if (!input.parentNode) { return; }   // 已被替换
            editTodo(todo.id, input.value);
        }
        input.addEventListener("blur", save);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { input.blur(); }
            else if (e.key === "Escape") {         // Esc 取消
                input.value = todo.text;
                input.blur();
            }
        });
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
            b.addEventListener("click", function () {
                setTheme(b.dataset.theme);
            });
        });
    }

    function setTheme(theme) {
        state.prefs.theme = theme;
        Storage.savePrefs({ theme: theme });
        document.documentElement.setAttribute("data-theme", theme);
        dom.themeOptions.querySelectorAll(".theme-option").forEach(function (b) {
            b.classList.toggle("active", b.dataset.theme === theme);
        });
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
            sw.classList.toggle("active", (sw.dataset.color || "") === cur);
        });
    }

    function applyAllPrefs() {
        document.documentElement.setAttribute("data-theme", state.prefs.theme);
        dom.soundToggle.checked = !!state.prefs.sound;
        applyMarkerColorVar();
    }

    /* ---------------------- 面板开关 ---------------------- */

    function openSettings() {
        dom.settingsPanel.classList.add("active");
        dom.settingsOverlay.classList.add("active");
        dom.settingsPanel.setAttribute("aria-hidden", "false");
    }
    function closeSettings() {
        dom.settingsPanel.classList.remove("active");
        dom.settingsOverlay.classList.remove("active");
        dom.settingsPanel.setAttribute("aria-hidden", "true");
    }

    /* ==================================================================
       七、事件绑定
       ================================================================== */

    function bindEvents() {
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
        showToast("主题：" + ({ light: "亮色", dark: "暗色", gradient: "渐变" })[next]);
    }

    /* ==================================================================
       八、初始化
       ================================================================== */

    function init() {
        // 加载数据
        state.todos = Storage.getTodos();
        state.prefs = Storage.getPrefs();

        // 旧数据可能存了已删除的动画类型，回退到默认
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
