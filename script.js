(function () {
    var createEl = function (tagName, attrs) {
        var anchor = document.createElement(tagName);
        Object.keys(attrs).forEach(function (key) {
            anchor[key] = attrs[key];
        });
        return anchor;
    };

    var createAnchorFromHeading = function (headingEl) {
        let href = '#' + (headingEl.id || headingEl.parentNode.id);
        return createEl(
            "a",
            {
                className: "ref",
                href: href,
                textContent: "#",
                title: headingEl.textContent
            }
        );
    };

    window.addEventListener("load", function () {
        Array.prototype.forEach.call(document.querySelectorAll("#main h1[id], #main h2[id], #main h3[id], #main h4[id], #main h5[id], #main section[id]>h2, #main section[id]>h3, #main section[id]>h4"), function (el) {
            var a = createAnchorFromHeading(el);
            el.classList.add("has-ref");
            el.addEventListener("click", function () {
                a.click();
            });
            el.insertBefore(a, el.firstChild);
        });

        if (document.querySelector("[data-controls]")) {
            document.querySelector("[data-controls]").setAttribute('style', '');
            document.querySelector("[data-expand]").addEventListener("click", function () {
                Array.prototype.forEach.call(document.querySelectorAll("details"), function (el) {
                    el.open = true;
                });
            });
            document.querySelector("[data-collapse]").addEventListener("click", function () {
                Array.prototype.forEach.call(document.querySelectorAll("details"), function (el) {
                    el.open = false;
                });
            });
        }

        if (window.location.hash) {
            if (window.location.hash === "#openall") {
                document.querySelector("[data-expand]").click();
            }
            else {
                var el = document.querySelector(window.location.hash);
                if (el && el.parentNode && (el.parentNode.nodeName === 'DETAILS')) {
                    el.parentNode.open = true;
                }
            }
        }
    });
})();
