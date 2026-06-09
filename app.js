/* ==========================================================================
   InvoiceQuick — A Copper Bay Labs product
   Client-side invoice generator. No backend, no network calls, no libraries.
   The form is the single source of truth: every input re-collects a model,
   recomputes totals, and re-renders the live invoice. Exports are built from
   that same model (print->PDF, standalone .html, reusable .json).
   ========================================================================== */
(function () {
  "use strict";

  var STORE = "invoicequick:v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var form = $("#invForm");
  var itemsEl = $("#items");
  var invoiceEl = $("#invoice");

  /* ---- small DOM builder; text is always set via textContent (XSS-safe) ---- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k]; // only ever fed trusted constant markup
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  /* ---- helpers ---- */
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function money(n, cur) {
    if (!isFinite(n)) n = 0;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(n);
    } catch (e) {
      return (cur || "USD") + " " + n.toFixed(2);
    }
  }

  function longDate(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function todayISO() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  /* ---- line-item rows ---- */
  function rowMarkup() {
    var row = h("div", { class: "item-row" });
    row.appendChild(h("input", { class: "desc", type: "text", "aria-label": "Item description", placeholder: "Design work — homepage" }));
    row.appendChild(h("input", { class: "qty", type: "number", inputmode: "decimal", min: "0", step: "any", "aria-label": "Quantity", placeholder: "1" }));
    row.appendChild(h("input", { class: "price", type: "number", inputmode: "decimal", min: "0", step: "any", "aria-label": "Unit price", placeholder: "0.00" }));
    row.appendChild(h("span", { class: "amt", text: "" }));
    var del = h("button", { class: "row-del", type: "button", "aria-label": "Remove line item", title: "Remove line item" });
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>';
    row.appendChild(del);
    return row;
  }

  function addRow(data) {
    var row = rowMarkup();
    if (data) {
      row.querySelector(".desc").value = data.desc || "";
      row.querySelector(".qty").value = (data.qty != null && data.qty !== "") ? data.qty : "";
      row.querySelector(".price").value = (data.price != null && data.price !== "") ? data.price : "";
    }
    itemsEl.appendChild(row);
    return row;
  }

  function rowEls() {
    return Array.prototype.slice.call(itemsEl.querySelectorAll(".item-row"));
  }

  function clearRows() { rowEls().forEach(function (r) { r.remove(); }); }

  /* ---- collect + compute ---- */
  function collect() {
    var m = {
      biz: form.bizName.value.trim(),
      bizDetails: form.bizDetails.value.trim(),
      client: form.clientName.value.trim(),
      clientDetails: form.clientDetails.value.trim(),
      invNumber: form.invNumber.value.trim(),
      currency: form.currency.value,
      issueDate: form.issueDate.value,
      dueDate: form.dueDate.value,
      taxLabel: form.taxLabel.value.trim(),
      taxRate: num(form.taxRate.value),
      discount: num(form.discount.value),
      notes: form.notes.value.trim(),
      items: []
    };
    rowEls().forEach(function (r) {
      m.items.push({
        desc: r.querySelector(".desc").value.trim(),
        qty: r.querySelector(".qty").value,
        price: r.querySelector(".price").value
      });
    });
    return m;
  }

  function compute(m) {
    var lines = m.items.map(function (it) {
      var q = it.qty === "" ? 1 : num(it.qty); // blank qty treated as 1
      var amount = q * num(it.price);
      return { desc: it.desc, qty: it.qty === "" ? "" : q, price: num(it.price), amount: amount, used: !!(it.desc || num(it.price) || (it.qty !== "" && num(it.qty))) };
    });
    var subtotal = lines.reduce(function (s, l) { return s + (l.used ? l.amount : 0); }, 0);
    var discount = Math.min(m.discount, subtotal);
    var taxable = subtotal - discount;
    var taxAmount = taxable * (m.taxRate / 100);
    return { lines: lines, subtotal: subtotal, discount: discount, taxAmount: taxAmount, total: taxable + taxAmount };
  }

  /* ---- render the live invoice ---- */
  function render() {
    var m = collect();
    var c = compute(m);
    var cur = m.currency;

    // update the in-form amount cells
    rowEls().forEach(function (r, i) {
      var l = c.lines[i];
      r.querySelector(".amt").textContent = (l && l.used) ? money(l.amount, cur) : "";
    });

    invoiceEl.textContent = "";

    var anything = m.biz || m.client || c.lines.some(function (l) { return l.used; });
    if (!anything) {
      var empty = h("div", { class: "inv-empty" });
      empty.innerHTML = '<svg class="ie-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6M9 17h4"/></svg>';
      empty.appendChild(h("h3", { text: "Your invoice will appear here" }));
      empty.appendChild(h("p", { text: "Add your business name and a line item on the left — this preview updates as you type." }));
      invoiceEl.appendChild(empty);
      return;
    }

    // top: from + INVOICE word
    var from = h("div", { class: "inv-from" }, [
      h("p", { class: "inv-bizname", text: m.biz || "Your business" }),
      m.bizDetails ? h("div", { class: "inv-lines", text: m.bizDetails }) : null
    ]);
    var right = h("div", { class: "inv-head-right" }, [
      h("p", { class: "inv-word", text: "INVOICE" }),
      m.invNumber ? h("p", { class: "inv-number", text: m.invNumber }) : null
    ]);
    invoiceEl.appendChild(h("div", { class: "inv-top" }, [from, right]));

    // parties + dates
    var billTo = h("div", { class: "inv-block" }, [
      h("p", { class: "inv-label", text: "Bill to" }),
      h("p", { class: "inv-to-name", text: m.client || "Client" }),
      m.clientDetails ? h("div", { class: "inv-lines", text: m.clientDetails }) : null
    ]);
    var dates = h("dl", { class: "inv-dates" });
    if (m.issueDate) { dates.appendChild(h("dt", { text: "Issued" })); dates.appendChild(h("dd", { text: longDate(m.issueDate) })); }
    if (m.dueDate) { dates.appendChild(h("dt", { text: "Due" })); dates.appendChild(h("dd", { class: "due", text: longDate(m.dueDate) })); }
    invoiceEl.appendChild(h("div", { class: "inv-parties" }, [billTo, dates]));

    // table
    var thead = h("thead", null, [h("tr", null, [
      h("th", { text: "Description" }),
      h("th", { class: "num", text: "Qty" }),
      h("th", { class: "num", text: "Unit price" }),
      h("th", { class: "num", text: "Amount" })
    ])]);
    var tbody = h("tbody");
    var shown = c.lines.filter(function (l) { return l.used; });
    if (shown.length === 0) {
      tbody.appendChild(h("tr", null, [h("td", { class: "idesc", colspan: "4", text: "No line items yet — add one on the left." })]));
    } else {
      shown.forEach(function (l) {
        tbody.appendChild(h("tr", null, [
          h("td", { class: "idesc", text: l.desc || "—" }),
          h("td", { class: "num", text: l.qty === "" ? "1" : String(l.qty) }),
          h("td", { class: "num", text: money(l.price, cur) }),
          h("td", { class: "num", text: money(l.amount, cur) })
        ]));
      });
    }
    invoiceEl.appendChild(h("table", { class: "inv-table" }, [thead, tbody]));

    // totals
    var dl = h("dl");
    function trow(label, value, cls) {
      return h("div", { class: "tr" + (cls ? " " + cls : "") }, [h("dt", { text: label }), h("dd", { text: value })]);
    }
    dl.appendChild(trow("Subtotal", money(c.subtotal, cur)));
    if (c.discount > 0) dl.appendChild(trow("Discount", "−" + money(c.discount, cur)));
    if (c.taxAmount > 0 || m.taxRate > 0) {
      var tl = (m.taxLabel || "Tax") + " (" + (m.taxRate % 1 === 0 ? m.taxRate : m.taxRate.toFixed(2)) + "%)";
      dl.appendChild(trow(tl, money(c.taxAmount, cur)));
    }
    dl.appendChild(trow("Total", money(c.total, cur), "grand"));
    invoiceEl.appendChild(h("div", { class: "inv-totals" }, [dl]));

    // notes
    if (m.notes) {
      invoiceEl.appendChild(h("div", { class: "inv-notes" }, [
        h("p", { class: "inv-label", text: "Notes" }),
        h("p", { text: m.notes })
      ]));
    }
    invoiceEl.appendChild(h("p", { class: "inv-thanks", text: "Thank you for your business." }));
  }

  /* ---- persistence ---- */
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(collect())); } catch (e) {}
  }

  function applyModel(m) {
    if (!m) return;
    form.bizName.value = m.biz || "";
    form.bizDetails.value = m.bizDetails || "";
    form.clientName.value = m.client || "";
    form.clientDetails.value = m.clientDetails || "";
    form.invNumber.value = m.invNumber || "";
    form.currency.value = m.currency || "USD";
    form.issueDate.value = m.issueDate || "";
    form.dueDate.value = m.dueDate || "";
    form.taxLabel.value = m.taxLabel || "";
    form.taxRate.value = (m.taxRate || m.taxRate === 0) ? m.taxRate : "";
    form.discount.value = (m.discount || m.discount === 0) ? m.discount : "";
    form.notes.value = m.notes || "";
    clearRows();
    var items = (m.items && m.items.length) ? m.items : [{}];
    items.forEach(function (it) { addRow(it); });
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORE); } catch (e) {}
    if (raw) {
      try { applyModel(JSON.parse(raw)); return true; } catch (e) {}
    }
    return false;
  }

  /* ---- exports ---- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function flash(btn) {
    if (!btn) return;
    btn.classList.add("copied");
    setTimeout(function () { btn.classList.remove("copied"); }, 1600);
  }

  function safeName(m) {
    var base = (m.invNumber || ("invoice-" + (m.issueDate || todayISO())));
    return base.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "invoice";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escLines(s) { return esc(s).replace(/\n/g, "<br>"); }

  function standaloneHTML(m, c) {
    var cur = m.currency;
    var rows = c.lines.filter(function (l) { return l.used; }).map(function (l) {
      return '<tr><td class="d">' + esc(l.desc || "—") + '</td><td class="n">' + (l.qty === "" ? "1" : esc(l.qty)) +
        '</td><td class="n">' + esc(money(l.price, cur)) + '</td><td class="n">' + esc(money(l.amount, cur)) + "</td></tr>";
    }).join("");
    var totals = '<tr><td></td><td></td><td class="tl">Subtotal</td><td class="n">' + esc(money(c.subtotal, cur)) + "</td></tr>";
    if (c.discount > 0) totals += '<tr><td></td><td></td><td class="tl">Discount</td><td class="n">−' + esc(money(c.discount, cur)) + "</td></tr>";
    if (c.taxAmount > 0 || m.taxRate > 0) totals += '<tr><td></td><td></td><td class="tl">' + esc((m.taxLabel || "Tax") + " (" + m.taxRate + "%)") + '</td><td class="n">' + esc(money(c.taxAmount, cur)) + "</td></tr>";
    totals += '<tr class="grand"><td></td><td></td><td class="tl">Total</td><td class="n">' + esc(money(c.total, cur)) + "</td></tr>";

    var dateRows = "";
    if (m.issueDate) dateRows += "<div><span>Issued</span> " + esc(longDate(m.issueDate)) + "</div>";
    if (m.dueDate) dateRows += '<div class="due"><span>Due</span> ' + esc(longDate(m.dueDate)) + "</div>";

    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>Invoice " + esc(m.invNumber || "") + " — " + esc(m.biz || "") + "</title><style>" +
      "*{box-sizing:border-box}body{font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#23262d;max-width:760px;margin:32px auto;padding:0 22px}" +
      ".top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:26px}" +
      ".biz{font-size:20px;font-weight:700;margin:0 0 4px}.muted{color:#6a6a6a;font-size:13px;line-height:1.5}" +
      ".word{font-size:30px;font-weight:800;color:#bf6b3c;letter-spacing:.02em;margin:0;text-align:right}.num0{text-align:right;color:#6a6a6a;font-size:13px;margin:6px 0 0}" +
      ".parties{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:20px}.lbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a;margin:0 0 4px}" +
      ".to-name{font-weight:700;font-size:15px;margin:0 0 3px}.dates{text-align:right;font-size:13px;color:#444}.dates span{color:#8a8a8a;display:inline-block;min-width:48px}.dates .due{color:#8f4a22}" +
      "table{width:100%;border-collapse:collapse;margin:0 0 16px}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#8a8a8a;text-align:left;padding:0 10px 8px;border-bottom:2px solid #e0ddd6}" +
      "td{padding:10px;border-bottom:1px solid #efece5;vertical-align:top}.d{font-weight:600;color:#23262d}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}th.n{text-align:right}" +
      ".totals td{border:0;padding:5px 10px;color:#555}.totals .tl{text-align:right;color:#555}.totals .grand td{border-top:2px solid #23262d;padding-top:10px;font-size:17px;font-weight:800;color:#23262d}.totals .grand .n{color:#8f4a22}" +
      ".notes{border-top:1px solid #efece5;padding-top:13px;margin-top:6px;color:#555;font-size:13px}.thanks{text-align:center;color:#9a9a9a;font-size:12.5px;margin-top:22px}" +
      "@media print{body{margin:0}@page{margin:18mm}}</style></head><body>" +
      '<div class="top"><div><p class="biz">' + esc(m.biz || "Your business") + '</p><div class="muted">' + escLines(m.bizDetails) + "</div></div>" +
      '<div><p class="word">INVOICE</p>' + (m.invNumber ? '<p class="num0">' + esc(m.invNumber) + "</p>" : "") + "</div></div>" +
      '<div class="parties"><div><p class="lbl">Bill to</p><p class="to-name">' + esc(m.client || "Client") + '</p><div class="muted">' + escLines(m.clientDetails) + "</div></div>" +
      '<div class="dates">' + dateRows + "</div></div>" +
      '<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<table class="totals"><tbody>' + totals + "</tbody></table>" +
      (m.notes ? '<div class="notes"><p class="lbl">Notes</p>' + escLines(m.notes) + "</div>" : "") +
      '<p class="thanks">Thank you for your business. &middot; Made with InvoiceQuick</p></body></html>';
  }

  /* ---- wire up ---- */
  function init() {
    if (!load()) {
      // fresh defaults
      form.invNumber.value = "INV-001";
      form.currency.value = "USD";
      form.issueDate.value = todayISO();
      addRow();
    }

    // any input/change → recompute, render, autosave
    form.addEventListener("input", function () { render(); save(); });
    form.addEventListener("change", function () { render(); save(); });

    // delegated remove-row
    itemsEl.addEventListener("click", function (e) {
      var del = e.target.closest && e.target.closest(".row-del");
      if (!del) return;
      var rows = rowEls();
      if (rows.length <= 1) {
        // clear the only row instead of removing it
        var r = rows[0];
        if (r) { r.querySelector(".desc").value = ""; r.querySelector(".qty").value = ""; r.querySelector(".price").value = ""; }
      } else {
        del.closest(".item-row").remove();
      }
      render(); save();
    });

    $("#addItem").addEventListener("click", function () {
      var row = addRow();
      var d = row.querySelector(".desc"); if (d) d.focus();
      render(); save();
    });

    $("#btnPrint").addEventListener("click", function () { window.print(); });

    $("#btnHtml").addEventListener("click", function () {
      var m = collect(), c = compute(m);
      download(safeName(m) + ".html", standaloneHTML(m, c), "text/html;charset=utf-8");
      flash(this);
    });

    $("#btnSave").addEventListener("click", function () {
      var m = collect();
      download(safeName(m) + ".json", JSON.stringify(m, null, 2), "application/json");
      flash(this);
    });

    $("#btnLoad").addEventListener("click", function () { $("#loadFile").click(); });
    $("#loadFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          applyModel(JSON.parse(reader.result));
          render(); save();
        } catch (err) {
          alert("That file didn't look like an InvoiceQuick .json export.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    $("#btnReset").addEventListener("click", function () {
      if (!confirm("Start a new blank invoice? This clears the current one.")) return;
      try { localStorage.removeItem(STORE); } catch (e) {}
      form.reset();
      clearRows();
      form.invNumber.value = "INV-001";
      form.currency.value = "USD";
      form.issueDate.value = todayISO();
      addRow();
      render(); save();
    });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
