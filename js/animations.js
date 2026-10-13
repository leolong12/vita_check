/* 动画注册、完成反馈和预览共用同一套实现。 */
(function (global) {
    "use strict";

    var TYPES = [
        { id: "strike", icon: "➖", name: "经典删除线", desc: "红线从左向右划过" },
        { id: "marker", icon: "🖊️", name: "马克笔涂划", desc: "可自定义颜色的荧光笔" }
    ];
    var comboCount = 0;
    var comboTimer;

    function reducedMotion() {
        return global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function applyAnimClass(el, type) {
        TYPES.forEach(function (t) { el.classList.remove("anim-" + t.id); });
        el.classList.add("anim-" + type);
    }

    function popCombo() {
        comboCount += 1;
        if (!reducedMotion()) {
            var popup = document.createElement("div");
            popup.className = "combo-popup" + (comboCount >= 3 ? " big" : "");
            popup.textContent = comboCount === 1 ? "+1" : comboCount + " COMBO!";
            document.body.appendChild(popup);
            setTimeout(function () { popup.remove(); }, 1200);
        }
        clearTimeout(comboTimer);
        comboTimer = setTimeout(function () { comboCount = 0; }, 1500);
    }

    function previewIn(container, type) {
        var old = container.querySelector(".preview-line");
        if (old) { old.remove(); }
        var line = document.createElement("div");
        line.className = "preview-line todo-item";
        line.innerHTML = '<span class="todo-text"><span class="text-wrap"><span class="text">完成一件小事，也值得庆祝</span><span class="strike-through"></span></span></span>';
        applyAnimClass(line.querySelector(".todo-text"), type);
        container.appendChild(line);
        setTimeout(function () {
            if (!line.isConnected) { return; }
            line.classList.add("completed");
            line.querySelector(".strike-through").classList.add("active");
        }, 100);
        setTimeout(function () { line.remove(); }, 2400);
    }

    global.Animations = {
        TYPES: TYPES,
        applyAnimClass: applyAnimClass,
        popCombo: popCombo,
        previewIn: previewIn
    };
})(window);
