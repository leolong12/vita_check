/* ========================================================================
   storage.js —— localStorage 封装
   统一处理序列化、错误捕获、命名空间隔离
   暴露全局对象：window.Storage
   ======================================================================== */

(function (global) {
    "use strict";

    // 命名空间前缀，避免与其他应用冲突
    var PREFIX = "vita_check_";
    var KEYS = {
        TODOS:   PREFIX + "todos",
        PREFS:   PREFIX + "prefs"
    };

    /**
     * 判断 localStorage 是否可用
     * （隐私模式 / 旧浏览器可能抛错）
     */
    function isAvailable() {
        try {
            var testKey = "__test__";
            global.localStorage.setItem(testKey, "1");
            global.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    var HAS_LS = isAvailable();
    var memory = {};

    /**
     * 通用读取：失败时回退到内存副本，保证流程不中断
     */
    function readRaw(key, fallback) {
        if (Object.prototype.hasOwnProperty.call(memory, key)) { return memory[key]; }
        if (!HAS_LS) { return fallback; }
        try {
            var raw = global.localStorage.getItem(key);
            if (raw === null) { return fallback; }
            return JSON.parse(raw);
        } catch (e) {
            console.warn("[storage] 读取失败:", key, e);
            return fallback;
        }
    }

    /**
     * 通用写入
     */
    function writeRaw(key, value) {
        memory[key] = value;
        if (!HAS_LS) { return false; }
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn("[storage] 写入失败:", key, e);
            return false;
        }
    }

    /**
     * 通用删除
     */
    function removeRaw(key) {
        delete memory[key];
        if (!HAS_LS) { return; }
        try {
            global.localStorage.removeItem(key);
        } catch (e) {
            console.warn("[storage] 删除失败:", key, e);
        }
    }

    /* ---------------------- 待办数据 ---------------------- */

    /**
     * 读取待办列表
     * @returns {Array} 待办数组
     */
    function getTodos() {
        var list = readRaw(KEYS.TODOS, []);
        // 容错：确保返回数组
        if (!Array.isArray(list)) { return []; }
        var seen = {};
        return list.filter(function (todo) {
            if (!todo || typeof todo.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(todo.id) ||
                seen[todo.id] || typeof todo.text !== "string" || !todo.text.trim()) { return false; }
            seen[todo.id] = true;
            return true;
        }).map(function (todo) {
            return {
                id: todo.id,
                text: todo.text,
                completed: todo.completed === true,
                createdAt: typeof todo.createdAt === "number" ? todo.createdAt : Date.now()
            };
        });
    }

    /**
     * 保存待办列表
     */
    function saveTodos(todos) {
        writeRaw(KEYS.TODOS, todos);
    }

    /* ---------------------- 偏好设置 ---------------------- */

    var DEFAULT_PREFS = {
        theme:      "light",     // light / dark / gradient
        gradientColors: ["#6366f1", "#ec4899"], // 自定义渐变的两端颜色
        animType:   "strike",    // strike / marker / cloud
        sound:      false,       // 是否开启音效
        markerColor: ""          // 马克笔划线颜色；空串 = 跟随主题 --success
    };

    /**
     * 读取偏好，与默认值合并（保证新增字段有默认值）
     */
    function getPrefs() {
        var saved = readRaw(KEYS.PREFS, {});
        saved = saved && typeof saved === "object" ? saved : {};
        return {
            theme: saved.theme === "custom" ? "gradient" : ["light", "dark", "gradient"].indexOf(saved.theme) !== -1 ? saved.theme : DEFAULT_PREFS.theme,
            gradientColors: [0, 1].map(function (index) {
                var color = Array.isArray(saved.gradientColors) ? saved.gradientColors[index] : index === 0 ? saved.customColor : null;
                return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_PREFS.gradientColors[index];
            }),
            animType: typeof saved.animType === "string" ? saved.animType : DEFAULT_PREFS.animType,
            sound: saved.sound === true,
            markerColor: typeof saved.markerColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.markerColor) ? saved.markerColor : ""
        };
    }

    /**
     * 保存偏好（部分更新）
     */
    function savePrefs(patch) {
        var current = getPrefs();
        var merged = Object.assign({}, current, patch);
        writeRaw(KEYS.PREFS, merged);
        return merged;
    }

    /* ---------------------- 维护 ---------------------- */

    /**
     * 清空所有应用数据
     */
    function clearAll() {
        removeRaw(KEYS.TODOS);
        removeRaw(KEYS.PREFS);
    }

    /* ---------------------- 导出 ---------------------- */

    global.Storage = {
        KEYS: KEYS,
        isAvailable: isAvailable,
        getTodos: getTodos,
        saveTodos: saveTodos,
        getPrefs: getPrefs,
        savePrefs: savePrefs,
        clearAll: clearAll
    };

})(window);
