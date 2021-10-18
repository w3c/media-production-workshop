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

        const toggle = document.querySelector('[data-action=toggle]');
        if (toggle) {
            const button = document.createElement('button');
            button.innerHTML = 'Expand talks descriptions ▶';
            button.setAttribute('data-action', 'expand');
            toggle.appendChild(button);

            button.addEventListener('click', _ => {
                if (button.getAttribute('data-action') === 'expand') {
                    button.setAttribute('data-action', 'collapse');
                    button.innerHTML = 'Collapse talks descriptions ▼';
                    [...document.querySelectorAll('details.talk')].forEach(talk => {
                        if (!talk.hasAttribute('open')) {
                            talk.setAttribute('open', '');
                        }
                    });
                }
                else {
                    button.setAttribute('data-action', 'expand');
                    button.innerHTML = 'Expand talks descriptions ▶';
                    [...document.querySelectorAll('details.talk')].forEach(talk => {
                        if (talk.hasAttribute('open')) {
                            talk.removeAttribute('open');
                        }
                    });
                }
            });
        }

    });
})();
