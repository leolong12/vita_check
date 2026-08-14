/* ========================================================================
   animations.js —— 动画控制与切换逻辑
   职责：
     1. 维护 2 种划掉动画的元信息（供设置面板渲染）
     2. 给待办项应用/切换动画类名
     3. +1 成就飘字、Combo 连击
     4. 云朵庆贺特效（独立庆祝开关）
   暴露全局对象：window.Animations
   ====================================================================== */

(function (global) {
    "use strict";

    /* ==================================================================
       一、动画类型注册表
       ================================================================== */
    var ANIM_TYPES = [
        { id: "strike", icon: "➖", name: "经典删除线", desc: "红线穿过文字" },
        { id: "marker", icon: "🖊️", name: "马克笔涂划", desc: "倾斜荧光笔划过" }
    ];

    // 所有动画类名（切换时需先移除这些）
    var ALL_CLASSES = ANIM_TYPES.map(function (t) {
        return "anim-" + t.id;
    });

    /**
     * 为指定 todo-text 元素应用动画类
     * @param {HTMLElement} textEl - .todo-text 元素
     * @param {String} type - 动画 id
     */
    function applyAnimClass(textEl, type) {
        if (!textEl) { return; }
        ALL_CLASSES.forEach(function (cls) { textEl.classList.remove(cls); });
        textEl.classList.add("anim-" + type);
    }

    /* ==================================================================
       二、+1 成就飘字 / Combo 连击
       ================================================================== */

    var comboCount = 0;
    var comboTimer = null;

    /**
     * 弹出 +1 飘字；连续调用会累计 Combo 计数
     */
    function popCombo() {
        comboCount += 1;

        // 飘字 DOM
        var popup = document.createElement("div");
        popup.className = "combo-popup";
        if (comboCount >= 3) { popup.classList.add("big"); }
        popup.textContent = comboCount === 1
            ? "+1"
            : comboCount + " COMBO!";
        // 随机水平偏移，避免叠加
        popup.style.right = (24 + Math.random() * 60) + "px";
        popup.style.top = (80 + Math.random() * 30) + "px";
        document.body.appendChild(popup);
        setTimeout(function () {
            if (popup.parentNode) { popup.parentNode.removeChild(popup); }
        }, 1200);

        // 连击窗口：1.5s 内继续完成视为连击
        if (comboTimer) { clearTimeout(comboTimer); }
        comboTimer = setTimeout(function () {
            comboCount = 0;
            comboTimer = null;
        }, 1500);
    }

    /* ==================================================================
       三、云朵庆贺特效（独立庆祝开关，不占划掉动画位）
       ================================================================== */

    /**
     * 完成待办时，在词的位置飘出几朵小云（body 层 fixed，不影响划线/飞行）
     * @param {HTMLElement} node - 被完成的词元素（仅用于取坐标）
     */
    function cloudPuffsAt(node) {
        if (!node) { return; }
        var rect = node.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var count = 4;
        for (var i = 0; i < count; i++) {
            var puff = document.createElement("span");
            puff.className = "cloud-puff";
            puff.style.left = (cx + Math.random() * 60 - 30) + "px";
            puff.style.top = (cy - 8 + Math.random() * 16) + "px";
            puff.style.setProperty("--delay", (i * 0.12) + "s");
            puff.style.setProperty("--drift", (Math.random() * 40 - 20) + "px");
            document.body.appendChild(puff);
            (function (el) {
                setTimeout(function () {
                    if (el.parentNode) { el.parentNode.removeChild(el); }
                }, 1000);
            })(puff);
        }
    }

    /* ==================================================================
       四、预览动画（设置面板）
       ================================================================== */

    /**
     * 在设置面板内创建一行预览文字，演示当前动画效果
     * @param {HTMLElement} container - 容器
     * @param {String} type - 动画 id
     */
    function previewIn(container, type) {
        // 清掉旧的预览
        var old = container.querySelector(".preview-line");
        if (old) { old.parentNode.removeChild(old); }

        var line = document.createElement("div");
        line.className = "preview-line todo-text";
        line.textContent = "点击圆圈，预览划掉效果";
        applyAnimClass(line, type);
        container.appendChild(line);

        // 触发完成态
        // 用一个伪父级类承载 .completed
        setTimeout(function () {
            line.classList.add("completed");
        }, 60);

        // 1.5s 后移除
        setTimeout(function () {
            if (line.parentNode) { line.parentNode.removeChild(line); }
        }, 1800);
    }

    /* ==================================================================
       导出
       ================================================================== */
    global.Animations = {
        TYPES: ANIM_TYPES,
        applyAnimClass: applyAnimClass,
        popCombo: popCombo,
        cloudPuffsAt: cloudPuffsAt,
        previewIn: previewIn
    };

})(window);
