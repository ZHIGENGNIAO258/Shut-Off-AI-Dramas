/* B 站 AI 漫剧屏蔽器 · 面板与交互 */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createUI(options) {
    var doc = options.doc;
    var store = options.store;
    var dom = options.dom;
    var getState = options.getState;
    var actions = options.actions;

    var tab = "page";
    var markMode = false;
    var toastTimer = null;
    var hoverTimer = null;
    var currentRecord = null;
    var LIST_PAGE_SIZE = 30;
    var listQuery = "";
    var listPage = 0;

    function make(tag, className, text) {
      var el = doc.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = String(text);
      return el;
    }

    function button(label, className, onClick) {
      var el = make("button", "ais-btn " + (className || ""), label);
      el.type = "button";
      el.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return el;
    }

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    /* ---------- 悬浮球 ---------- */

    var fab = make("button", "ais-fab");
    fab.id = "ais-fab";
    fab.type = "button";
    fab.title = "AI 漫剧屏蔽器";
    var fabCount = make("span", "ais-fab-count", "0");
    fab.appendChild(make("span", "ais-fab-dot", "AI"));
    fab.appendChild(fabCount);
    fab.addEventListener("click", function (event) {
      event.stopPropagation();
      togglePanel();
    });

    /* ---------- 面板 ---------- */

    var panel = make("section", "ais-panel");
    panel.id = "ais-panel";
    panel.hidden = true;

    var panelHead = make("div", "ais-panel-head");
    var panelTitle = make("strong", "", "AI 漫剧屏蔽器");
    var panelClose = button("×", "ais-icon-btn", function () {
      panel.hidden = true;
    });
    panelHead.appendChild(panelTitle);
    panelHead.appendChild(panelClose);

    var tabsBar = make("div", "ais-tabs");
    var tabDefs = [
      ["page", "本页"],
      ["pending", "待确认"],
      ["list", "名单"],
      ["settings", "设置"]
    ];
    var tabButtons = {};
    tabDefs.forEach(function (def) {
      var btn = button(def[1], "ais-tab", function () {
        tab = def[0];
        render();
      });
      btn.dataset.tab = def[0];
      tabButtons[def[0]] = btn;
      tabsBar.appendChild(btn);
    });

    var panelBody = make("div", "ais-panel-body");
    var panelFoot = make("div", "ais-panel-foot", "本地屏蔽，不修改账号 · 名单以 mid 为主键");
    panel.appendChild(panelHead);
    panel.appendChild(tabsBar);
    panel.appendChild(panelBody);
    panel.appendChild(panelFoot);

    /* ---------- 悬停工具条 ---------- */

    var hover = make("div", "ais-hover");
    hover.id = "ais-hover";
    hover.hidden = true;
    var hoverMark = button("屏蔽", "ais-btn-primary", function () {
      if (!currentRecord) return;
      actions.mark(currentRecord.mid, "manual");
      hover.hidden = true;
      toast("已屏蔽 " + (currentRecord.name || currentRecord.mid), function () {
        actions.undoMark();
      });
    });
    hover.appendChild(hoverMark);

    /* ---------- 模态框 ---------- */

    var modal = make("div", "ais-modal");
    modal.id = "ais-modal";
    modal.hidden = true;
    var modalCard = make("div", "ais-modal-card");
    var modalHead = make("div", "ais-modal-head");
    var modalTitle = make("strong", "", "");
    var modalClose = button("×", "ais-icon-btn", function () {
      closeModal();
    });
    modalHead.appendChild(modalTitle);
    modalHead.appendChild(modalClose);
    var modalBody = make("div", "ais-modal-body");
    var modalFoot = make("div", "ais-modal-foot");
    modalCard.appendChild(modalHead);
    modalCard.appendChild(modalBody);
    modalCard.appendChild(modalFoot);
    modal.appendChild(modalCard);
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    /* ---------- Toast ---------- */

    var toastEl = make("div", "ais-toast");
    toastEl.id = "ais-toast";
    toastEl.hidden = true;
    var toastText = make("span", "", "");
    var toastAction = button("撤销", "ais-toast-btn", function () {});
    toastEl.appendChild(toastText);
    toastEl.appendChild(toastAction);

    doc.body.appendChild(fab);
    doc.body.appendChild(panel);
    doc.body.appendChild(hover);
    doc.body.appendChild(modal);
    doc.body.appendChild(toastEl);

    /* ---------- 通用 ---------- */

    function openModal(title, content, buttons) {
      modalTitle.textContent = title;
      clear(modalBody);
      modalBody.appendChild(content);
      clear(modalFoot);
      (buttons || []).forEach(function (item) {
        modalFoot.appendChild(button(item.label, item.primary ? "ais-btn-primary" : "", item.onClick));
      });
      modal.hidden = false;
    }

    function closeModal() {
      modal.hidden = true;
      clear(modalBody);
      clear(modalFoot);
    }

    function toast(message, undo) {
      clearTimeout(toastTimer);
      toastText.textContent = message;
      toastAction.style.display = undo ? "" : "none";
      toastAction.onclick = function () {
        toastEl.hidden = true;
        if (undo) undo();
      };
      toastEl.hidden = false;
      toastTimer = setTimeout(function () {
        toastEl.hidden = true;
      }, 5000);
    }

    function togglePanel() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) render();
    }

    function accountName(account, mid) {
      return account && account.name ? account.name : "mid " + mid;
    }

    function accountSamples(account) {
      var samples = account && Array.isArray(account.samples) ? account.samples : [];
      return samples.filter(function (item) {
        return typeof item === "string" && item;
      });
    }

    function row(title, subtitle, buttons, samples) {
      var wrap = make("div", "ais-row");
      var main = make("div", "ais-row-main");
      main.appendChild(make("div", "ais-row-title", title));
      if (subtitle) main.appendChild(make("div", "ais-row-sub", subtitle));
      if (samples && samples.length) {
        var sampleBox = make("div", "ais-row-samples");
        samples.slice(0, 2).forEach(function (text) {
          sampleBox.appendChild(make("div", "ais-sample", "《" + text + "》"));
        });
        main.appendChild(sampleBox);
      }
      wrap.appendChild(main);
      if (buttons && buttons.length) {
        var side = make("div", "ais-row-side");
        buttons.forEach(function (btn) {
          side.appendChild(btn);
        });
        wrap.appendChild(side);
      }
      return wrap;
    }

    function emptyHint(text) {
      return make("p", "ais-empty", text);
    }

    /* ---------- 各 tab ---------- */

    function renderPage() {
      var state = getState();
      var hidden = [];
      state.records.forEach(function (record) {
        if (dom.isHidden(record.wrapper)) hidden.push(record);
      });
      hidden.sort(function (a, b) {
        return (b.at || 0) - (a.at || 0);
      });

      var head = make("div", "ais-summary");
      head.appendChild(make("span", "ais-summary-num", String(hidden.length)));
      head.appendChild(make("span", "", " 条已隐藏 / 本页共 " + state.records.size + " 条视频"));
      panelBody.appendChild(head);

      if (state.surface.id === "search" && state.records.size > 0) {
        panelBody.appendChild(
          button("把本页所有 UP 加入名单（" + state.records.size + "）", "ais-btn-wide", function () {
            var total = state.records.size;
            openModal(
              "批量标记",
              make(
                "p",
                "",
                "将把本页 " + total + " 个 UP 全部加入名单。之后在主页和搜索页都不再显示他们的视频；单个账号可在「名单」里移除。"
              ),
              [
                {
                  label: "应用",
                  primary: true,
                  onClick: function () {
                    var count = actions.markPage();
                    closeModal();
                    toast("已加入 " + count + " 个账号");
                  }
                },
                { label: "取消", onClick: closeModal }
              ]
            );
          })
        );
      }

      if (hidden.length === 0) {
        panelBody.appendChild(emptyHint("本页暂时没有命中。滚动加载新内容后会自动继续判断。"));
        return;
      }
      panelBody.appendChild(
        button("恢复本页全部（加入白名单）", "ais-btn-wide", function () {
          hidden.forEach(function (record) {
            actions.restore(record.mid);
          });
          toast("已恢复本页 " + hidden.length + " 条");
        })
      );

      hidden.slice(0, 40).forEach(function (record) {
        var subtitle = (record.reasons && record.reasons.length ? record.reasons.join(" · ") : "名单命中") + " · mid " + record.mid;
        panelBody.appendChild(
          row(record.title || "（无标题）", subtitle, [
            button("恢复", "", function () {
              actions.restore(record.mid);
              toast("已恢复并加入白名单");
            })
          ])
        );
      });
    }

    function renderPending() {
      var accounts = store.data.accounts;
      var keys = Object.keys(accounts);
      var pending = keys.filter(function (mid) {
        var account = accounts[mid];
        return account.status === "pending" || account.confidence === "auto";
      });
      if (pending.length === 0) {
        panelBody.appendChild(emptyHint("没有待确认的账号。规则自动命中的账号会先出现在这里。"));
        return;
      }
      panelBody.appendChild(
        button("全部确认（加入名单）", "ais-btn-wide ais-btn-primary", function () {
          actions.confirmMany(pending.map(Number));
          toast("已确认 " + pending.length + " 个账号");
        })
      );
      pending.forEach(function (mid) {
        var account = accounts[mid];
        var reasons = (account.reasons || []).join(" · ");
        var subtitle = "mid " + mid;
        if (reasons) subtitle += " · " + reasons;
        subtitle += " · 命中 " + account.hits + " 次";
        var samples = accountSamples(account);
        var node = row(
          accountName(account, mid),
          subtitle,
          [
            button("确认", "ais-btn-primary", function () {
              actions.confirm(Number(mid));
              toast("已确认");
            }),
            button("误伤", "", function () {
              actions.dismiss(Number(mid));
              toast("已恢复并加入白名单");
            })
          ],
          samples
        );
        if (!samples.length) {
          node
            .querySelector(".ais-row-main")
            .appendChild(make("div", "ais-sample ais-sample-empty", "暂无标题样本（旧版本命中，刷到同类卡片会补上）"));
        }
        panelBody.appendChild(node);
      });
    }

    function parseMid(value) {
      var text = String(value || "").trim();
      if (!text) return 0;
      var match = text.match(/space\.bilibili\.com\/(\d{1,12})/i);
      if (match) return parseInt(match[1], 10);
      if (/^\d{1,12}$/.test(text)) return parseInt(text, 10);
      return 0;
    }

    function hiddenEntries(query) {
      var q = String(query || "").trim().toLowerCase();
      var items = Object.keys(store.data.accounts)
        .map(Number)
        .filter(function (mid) {
          var account = store.data.accounts[mid];
          return !!account && account.status === "hidden";
        })
        .map(function (mid) {
          var account = store.data.accounts[mid];
          return { mid: mid, account: account, name: accountName(account, mid) };
        });
      if (q) {
        items = items.filter(function (item) {
          return item.name.toLowerCase().indexOf(q) !== -1 || String(item.mid).indexOf(q) !== -1;
        });
      }
      items.sort(function (a, b) {
        var byName = a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
        return byName !== 0 ? byName : a.mid - b.mid;
      });
      return items;
    }

    function syncHint() {
      var meta = store.data.meta || {};
      if (!meta.lastSync) return "还没同步过。默认订阅仓库 list/ai-slop.json，只新增，不删除本地记录。";
      var date = new Date(meta.lastSync);
      var pad = function (value) {
        return value < 10 ? "0" + value : String(value);
      };
      var when = date.getMonth() + 1 + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
      return "上次同步 " + when + (meta.lastSyncCount ? " · 拉取 " + meta.lastSyncCount + " 条" : "");
    }

    function renderList() {
      var counts = store.counts();
      var summary = make("div", "ais-summary");
      summary.appendChild(make("span", "ais-summary-num", String(counts.hidden)));
      summary.appendChild(make("span", "", " 个账号在名单中（按名称排序）"));
      panelBody.appendChild(summary);

      function doSync() {
        actions.syncRemote().then(function (result) {
          if (result && result.ok) {
            var message = "同步完成：新增 " + result.added + " 个";
            if (result.upgraded) message += "，待确认转正 " + result.upgraded + " 个";
            if (result.total) message += "（共 " + result.total + " 条）";
            toast(message);
          } else {
            toast("同步失败：" + ((result && result.error) || "未知错误"));
          }
        });
      }

      var toolbar = make("div", "ais-toolbar");
      toolbar.appendChild(
        button("导出名单", "ais-btn-primary", function () {
          var data = actions.exportList();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var link = doc.createElement("a");
          link.href = url;
          link.download = "bili-ai-slop-list.json";
          doc.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1000);
          toast("已导出 " + data.entries.length + " 个账号");
        })
      );
      toolbar.appendChild(button("导入名单", "", chooseImportFile));
      toolbar.appendChild(button("同步订阅", "", doSync));
      panelBody.appendChild(toolbar);

      var searchRow = make("div", "ais-list-tools");
      var searchInput = doc.createElement("input");
      searchInput.type = "search";
      searchInput.className = "ais-input";
      searchInput.placeholder = "搜索昵称 / mid";
      searchInput.value = listQuery;
      searchRow.appendChild(searchInput);
      panelBody.appendChild(searchRow);

      var addRow = make("div", "ais-add-row");
      var midInput = doc.createElement("input");
      midInput.type = "text";
      midInput.className = "ais-input ais-input-mid";
      midInput.placeholder = "mid 或空间链接";
      var nameInput = doc.createElement("input");
      nameInput.type = "text";
      nameInput.className = "ais-input";
      nameInput.placeholder = "备注名（可选）";

      function submitAdd() {
        var mid = parseMid(midInput.value);
        if (!mid) {
          toast("请填写数字 mid 或 space.bilibili.com/123 链接");
          return;
        }
        var name = nameInput.value.trim();
        listQuery = "";
        listPage = 0;
        var result = actions.addManual(mid, name);
        if (result && result.ok) toast("已添加 " + (name || "mid " + mid));
        else toast((result && result.error) || "添加失败");
      }

      midInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") submitAdd();
      });
      nameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") submitAdd();
      });
      addRow.appendChild(midInput);
      addRow.appendChild(nameInput);
      addRow.appendChild(button("添加", "ais-btn-primary", submitAdd));
      panelBody.appendChild(addRow);

      var rowsBox = make("div", "ais-list-rows");
      var pagerBox = make("div", "ais-pager");
      panelBody.appendChild(rowsBox);
      panelBody.appendChild(pagerBox);

      var syncRow = make("div", "ais-sync");
      var urlInput = doc.createElement("input");
      urlInput.type = "url";
      urlInput.className = "ais-input";
      urlInput.placeholder = "订阅地址（raw.githubusercontent.com / jsDelivr）";
      urlInput.value = store.settings().listUrl || "";
      urlInput.addEventListener("change", function () {
        actions.saveSetting("listUrl", urlInput.value.trim());
      });
      syncRow.appendChild(urlInput);
      syncRow.appendChild(
        button("同步", "", doSync)
      );
      panelBody.appendChild(syncRow);
      panelBody.appendChild(make("p", "ais-sync-meta", syncHint()));

      function paint() {
        clear(rowsBox);
        clear(pagerBox);
        rowsBox.scrollTop = 0;
        var items = hiddenEntries(listQuery);
        if (!items.length) {
          rowsBox.appendChild(
            emptyHint(listQuery ? "没有匹配「" + listQuery + "」的账号。" : "名单还是空的。在卡片上点「屏蔽」，或在上方手动添加。")
          );
          return;
        }
        var pages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
        if (listPage < 0) listPage = 0;
        if (listPage > pages - 1) listPage = pages - 1;
        items.slice(listPage * LIST_PAGE_SIZE, (listPage + 1) * LIST_PAGE_SIZE).forEach(function (item) {
          var label = item.account.confidence === "auto" ? "自动" : item.account.source === "remote" ? "订阅" : "手动";
          rowsBox.appendChild(
            row(item.name, label + " · mid " + item.mid, [
              button("移除", "", function () {
                actions.dismiss(item.mid);
                toast("已移除并加入白名单");
              })
            ])
          );
        });
        var prev = button("上一页", "", function () {
          listPage -= 1;
          paint();
        });
        prev.disabled = listPage === 0;
        var next = button("下一页", "", function () {
          listPage += 1;
          paint();
        });
        next.disabled = listPage >= pages - 1;
        pagerBox.appendChild(prev);
        pagerBox.appendChild(make("span", "ais-pager-info", listPage + 1 + " / " + pages + " · 共 " + items.length + " 个"));
        pagerBox.appendChild(next);
      }

      searchInput.addEventListener("input", function () {
        listQuery = searchInput.value;
        listPage = 0;
        paint();
      });

      paint();
    }

    function renderSettings() {
      var settings = store.settings();
      var defs = [
        ["autoHideHigh", "自动隐藏高置信结果", "昵称/标题/简介/标签明确写了 AI 的账号"],
        ["genreMode", "识别漫剧/短剧生产号", "剧场/短剧/漫剧类账号 + 连载模板；会包含非 AI 动态漫"],
        ["mediumBadge", "可疑卡片打角标", "只提示，不隐藏"],
        ["showPlaceholder", "隐藏后保留占位条", "默认直接收起，避免首页留白"],
        ["enrich", "低频读取 UP 简介/标签", "只读公开接口，用于识别简介/标签里自报 AI 的账号"],
        ["remoteList", "启用远程名单", "只隐藏；远程条目默认只信任人工确认的"]
      ];
      defs.forEach(function (def) {
        var label = make("label", "ais-check");
        var input = doc.createElement("input");
        input.type = "checkbox";
        input.checked = !!settings[def[0]];
        input.addEventListener("change", function () {
          actions.saveSetting(def[0], input.checked);
        });
        label.appendChild(input);
        var textWrap = make("span", "", def[1]);
        textWrap.appendChild(make("small", "ais-check-note", def[2]));
        label.appendChild(textWrap);
        panelBody.appendChild(label);
      });
      panelBody.appendChild(
        button("恢复全部（清空白名单）", "", function () {
          var whitelist = store.data.whitelist;
          Object.keys(whitelist).forEach(function (mid) {
            actions.unwhitelist(Number(mid));
          });
          toast("已清空白名单");
        })
      );
    }

    function render() {
      clear(panelBody);
      Object.keys(tabButtons).forEach(function (key) {
        tabButtons[key].classList.toggle("ais-tab-active", key === tab);
      });
      if (tab === "page") renderPage();
      else if (tab === "pending") renderPending();
      else if (tab === "list") renderList();
      else renderSettings();
      var counts = store.counts();
      var version = (typeof globalThis !== "undefined" && globalThis.AIS_VERSION) || "";
      panelFoot.textContent =
        (version ? "v" + version + " · " : "") +
        "名单 " +
        counts.hidden +
        " · 待确认 " +
        counts.pending +
        " · 本地屏蔽，不修改账号";
    }

    function refresh(forceRender) {
      var state = getState();
      fabCount.textContent = String(state.hiddenCount);
      fab.classList.toggle("ais-fab-hot", state.hiddenCount > 0);
      if (forceRender && !panel.hidden) render();
    }

    /* ---------- 导入 ---------- */

    function chooseImportFile() {
      var input = doc.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          handleImportText(String(reader.result || ""));
        };
        reader.readAsText(file);
      });
      input.click();
    }

    function handleImportText(text) {
      var preview = actions.previewImport(text);
      if (!preview.ok) {
        toast("导入失败：" + preview.error);
        return;
      }
      var box = make("div", "");
      box.appendChild(make("p", "", "共 " + preview.total + " 个账号：人工确认 " + preview.confirmed + " 个，自动识别 " + preview.auto + " 个。"));
      var label = make("label", "ais-check");
      var checkbox = doc.createElement("input");
      checkbox.type = "checkbox";
      label.appendChild(checkbox);
      label.appendChild(make("span", "", "同时导入自动识别的条目"));
      box.appendChild(label);
      openModal("导入名单", box, [
        {
          label: "应用",
          primary: true,
          onClick: function () {
            var added = actions.applyImport(preview.entries, checkbox.checked);
            closeModal();
            toast("已导入 " + added + " 个账号");
            refresh();
          }
        },
        { label: "取消", onClick: closeModal }
      ]);
    }

    /* ---------- 标记模式 ---------- */

    function setMarkMode(next) {
      markMode = !!next;
      actions.setMarkMode(markMode);
      fab.textContent = "";
      fab.appendChild(make("span", "ais-fab-dot", markMode ? "标" : "AI"));
      fab.appendChild(fabCount);
      toast(markMode ? "标记模式：点击卡片即屏蔽该 UP，按 Esc 退出" : "已退出标记模式");
    }

    /* ---------- 事件 ---------- */

    doc.addEventListener(
      "mouseover",
      function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest("#ais-panel, #ais-fab, #ais-hover, #ais-modal, #ais-toast")) return;
        var state = getState();
        var wrapper = state.surface.wrapperOf(target);
        if (!wrapper) {
          hover.hidden = true;
          return;
        }
        var record = state.records.get(wrapper);
        if (!record) {
          hover.hidden = true;
          return;
        }
        currentRecord = record;
        clearTimeout(hoverTimer);
        var rect = wrapper.getBoundingClientRect();
        hover.style.top = Math.max(8, rect.top + 6) + "px";
        hover.style.left = Math.max(8, rect.left + 6) + "px";
        hover.hidden = false;
      },
      true
    );

    doc.addEventListener(
      "mouseout",
      function (event) {
        if (!currentRecord) return;
        var related = event.relatedTarget;
        if (related && related.closest && related.closest("#ais-hover")) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () {
          hover.hidden = true;
        }, 160);
      },
      true
    );

    doc.addEventListener("keydown", function (event) {
      var tagName = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key === "Escape") {
        if (!modal.hidden) closeModal();
        else if (markMode) setMarkMode(false);
        else if (!panel.hidden) panel.hidden = true;
        return;
      }
      if (event.key === "m" || event.key === "M") {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        setMarkMode(!markMode);
      }
    });

    return {
      refresh: refresh,
      toast: toast,
      setMarkMode: setMarkMode,
      isMarkMode: function () {
        return markMode;
      },
      toggle: togglePanel
    };
  }

  return { createUI: createUI };
});
