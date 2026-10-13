/* 真实 DOM 词云：测量文字后以螺旋寻找空位，保留文字与键盘交互。 */
(function (global) {
    "use strict";

    var seed = 0;
    var lastWidth = 0;
    var resizeTimer;

    function hash(value) {
        var result = 2166136261;
        for (var i = 0; i < value.length; i++) {
            result = Math.imul(result ^ value.charCodeAt(i), 16777619);
        }
        return result >>> 0;
    }

    function arrange(list) {
        var width = list.clientWidth;
        if (!width) { return; }
        var nodes = Array.from(list.querySelectorAll(".cloud-item"));
        var scale = Math.min(1, Math.max(0.48, width / 900));
        var baseHeight = width < 600 ? 480 : 490;
        var placed = [];
        var items = nodes.map(function (node) {
            var word = node.querySelector(".cloud-word");
            var text = node.querySelector(".text").textContent;
            var value = hash(text + ":" + seed);
            var sizes = [74, 60, 48, 40, 32, 28, 24];
            var size = Math.max(15, Math.round(sizes[value % sizes.length] * scale));
            if (text.length > 12) { size = Math.min(size, Math.round(30 * scale)); }
            var angle = text.length > 10 ? 0 : [0, 0, 0, 0, -90, 90, -12, 12][Math.floor(value / 7) % 8];
            word.style.fontSize = size + "px";
            word.style.maxWidth = Math.max(140, Math.min(width - 42, 420 * scale)) + "px";
            word.style.setProperty("--word-angle", angle + "deg");
            node.style.setProperty("--word-color", "var(--cloud-color-" + (value % 6) + ")");
            var w = word.offsetWidth;
            var h = word.offsetHeight;
            var radians = angle * Math.PI / 180;
            return {
                node: node,
                width: Math.ceil(Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians))) + 12,
                height: Math.ceil(Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians))) + 12,
                value: value,
                size: size
            };
        });
        items.sort(function (a, b) { return b.size - a.size || a.value - b.value; });
        var area = items.reduce(function (sum, item) { return sum + item.width * item.height; }, 0);
        var height = Math.max(baseHeight, Math.ceil(area / (width * 0.60)));
        var overflowY = height;

        items.forEach(function (item) {
            var position = null;
            var phase = (item.value % 100) / 100 * Math.PI * 2;
            for (var step = 0; step < 2600; step++) {
                var theta = step * 0.18 + phase;
                var radius = 1.15 * step / 6;
                var x = width / 2 + Math.cos(theta) * radius * (width / height) - item.width / 2;
                var y = height / 2 + Math.sin(theta) * radius - item.height / 2;
                if (x < 8 || y < 8 || x + item.width > width - 8 || y + item.height > height - 8) { continue; }
                var candidate = { x: x, y: y, width: item.width, height: item.height };
                var collides = placed.some(function (other) {
                    return candidate.x < other.x + other.width && candidate.x + candidate.width > other.x &&
                        candidate.y < other.y + other.height && candidate.y + candidate.height > other.y;
                });
                if (!collides) { position = candidate; break; }
            }
            // 大量或长文本任务放到下方，保证每项都完整可见。
            if (!position) {
                position = { x: (width - item.width) / 2, y: overflowY + 12, width: item.width, height: item.height };
                overflowY += item.height + 16;
            }
            placed.push(position);
            item.node.style.left = Math.round(position.x) + "px";
            item.node.style.top = Math.round(position.y) + "px";
            item.node.style.width = item.width + "px";
            item.node.style.height = item.height + "px";
            item.node.classList.add("placed");
        });
        list.style.height = Math.ceil(Math.max(height, overflowY)) + "px";
        lastWidth = width;
    }

    function observe(list) {
        var observer = new ResizeObserver(function () {
            if (list.clientWidth === lastWidth) { return; }
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { arrange(list); }, 100);
        });
        observer.observe(list);
        document.fonts.ready.then(function () { arrange(list); });
    }

    global.CloudLayout = {
        arrange: arrange,
        observe: observe,
        shuffle: function (list) { seed += 1; arrange(list); }
    };
})(window);
