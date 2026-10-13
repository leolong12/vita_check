/* 动画注册、完成反馈和预览共用同一套实现。 */
(function (global) {
    "use strict";

    var TYPES = [
        { id: "strike", icon: "➖", name: "经典删除线", desc: "红线从左向右划过" },
        { id: "ink", icon: "💧", name: "墨水晕染", desc: "墨滴扩散，文字融入墨迹" },
        { id: "shatter", icon: "💎", name: "碎裂消散", desc: "文字碎片向四周飞散" },
        { id: "lightning", icon: "⚡", name: "闪电划过", desc: "一道电光划过，留下完成标记" },
        { id: "fold", icon: "📄", name: "折叠收起", desc: "任务像纸张一样折起，再归入完成态" },
        { id: "particle", icon: "🎆", name: "粒子爆炸", desc: "文字化作彩色粒子散开" },
        { id: "marker", icon: "🖊️", name: "马克笔涂划", desc: "可自定义颜色的荧光笔" },
        { id: "cloud", icon: "☁️", name: "云朵庆贺", desc: "小云朵升起，留下完成标记" }
    ];
    var comboCount = 0;
    var comboTimer;
    var colors = ["#818cf8", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

    function reducedMotion() {
        return global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function applyAnimClass(el, type) {
        TYPES.forEach(function (t) { el.classList.remove("anim-" + t.id); });
        el.classList.add("anim-" + type);
    }

    function clearEffect(node) {
        if (node._effectTimer) { clearTimeout(node._effectTimer); }
        node.classList.remove("animating");
        node.querySelectorAll(".effect-layer").forEach(function (el) { el.remove(); });
    }

    function complete(node, type) {
        clearEffect(node);
        if (reducedMotion()) { return; }
        node.classList.add("animating");
        var text = node.querySelector(".todo-text");
        var content = node.querySelector(".text");
        if (!text || !content) { return; }
        if (["shatter", "particle", "cloud"].indexOf(type) !== -1) {
            var layer = document.createElement("span");
            layer.className = "effect-layer effect-" + type;
            layer.setAttribute("aria-hidden", "true");
            var letters = Array.from(content.textContent);
            var count = type === "particle" ? 24 : type === "cloud" ? 4 : Math.min(letters.length, 40);
            for (var i = 0; i < count; i++) {
                var piece = document.createElement("span");
                piece.className = "effect-piece";
                piece.textContent = type === "shatter" ? letters[i] : type === "cloud" ? "☁" : "";
                piece.style.left = ((i + 0.5) / count * 95) + "%";
                piece.style.setProperty("--dx", (Math.random() * 150 - 75) + "px");
                piece.style.setProperty("--dy", (-35 - Math.random() * 100) + "px");
                piece.style.setProperty("--turn", (Math.random() * 240 - 120) + "deg");
                piece.style.setProperty("--delay", (Math.random() * 0.12) + "s");
                piece.style.setProperty("--piece-color", colors[i % colors.length]);
                layer.appendChild(piece);
            }
            text.appendChild(layer);
        }
        node._effectTimer = setTimeout(function () { clearEffect(node); }, 1100);
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
        if (old) { clearEffect(old); old.remove(); }
        var line = document.createElement("div");
        line.className = "preview-line todo-item";
        line.innerHTML = '<span class="todo-text"><span class="text-wrap"><span class="text">完成一件小事，也值得庆祝</span><span class="strike-through"></span></span></span>';
        applyAnimClass(line.querySelector(".todo-text"), type);
        container.appendChild(line);
        setTimeout(function () {
            if (!line.isConnected) { return; }
            line.classList.add("completed");
            line.querySelector(".strike-through").classList.add("active");
            complete(line, type);
        }, 100);
        setTimeout(function () { clearEffect(line); line.remove(); }, 2400);
    }

    global.Animations = {
        TYPES: TYPES,
        applyAnimClass: applyAnimClass,
        complete: complete,
        clearEffect: clearEffect,
        popCombo: popCombo,
        previewIn: previewIn
    };
})(window);
