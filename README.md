# InvoiceQuick

**Send a clean invoice in the next two minutes — free, no signup.**

InvoiceQuick is a 100% client-side invoice generator. Fill in your client and
line items, pick a currency, and download a polished **PDF** (or `.html`, or a
reusable `.json`) — no account, no watermark, no ads, nothing uploaded.

A **Copper Bay Labs** product.

- **Live:** https://dukotah.github.io/invoicequick/
- **100% in your browser.** Your business details, client info, rates, and
  totals **never leave the tab**. There is no InvoiceQuick backend. The invoice
  autosaves only to this browser's local storage. The only third-party request
  is to Google Fonts, which degrades gracefully to system fonts.

## What it does

- **Live invoice** that totals as you type — line items (qty × unit price),
  subtotal, a flat discount, and a tax rate you name (VAT / GST / sales tax).
- **15+ currencies**, each formatted correctly (including zero-decimal
  currencies like JPY) via the browser's `Intl` API.
- **Download PDF** using the browser's native “Save as PDF” — a print
  stylesheet renders just the invoice. No plugin, works offline, no watermark.
- **Reusable** — save an invoice as a small `.json` and load it next month to
  re-bill in seconds. Also exports a standalone `.html` invoice.

## Part of the Copper Bay Labs workshop

Small, free, no-signup tools that run entirely in your browser:

- **[ComplyKit](https://dukotah.github.io/complykit/)** — privacy policy, terms
  & cookie-consent generator (GDPR/CCPA aware).
- **[ShipSafe](https://dukotah.github.io/shipsafe/)** — plain-English ADA &
  privacy risk report for your site.
- **[LeakCheck](https://dukotah.github.io/leakcheck/)** — find exposed API keys
  & secrets in your code.
- **[DepCheck](https://dukotah.github.io/depcheck/)** — find risky dependencies
  in your `package.json`.

## Run it locally

No build step, no dependencies. Just open `index.html` in any modern browser:

```
git clone https://github.com/Dukotah/invoicequick.git
cd invoicequick
# open index.html (double-click, or `start index.html` on Windows)
```

## What it is (and isn't)

InvoiceQuick **formats** an invoice; it is **not tax or legal advice**. It does
not know your jurisdiction's required fields or the correct tax rate for your
work — that's on you. Check your local requirements. See
[How it works](about.html) for the full privacy stance and export details.

## Roadmap

- **InvoiceQuick Pro** (waitlist on the site): saved clients, automatic invoice
  numbering, a “Pay now” payment link, and automatic overdue reminders.

---

A [Copper Bay Labs](https://copperbaytech.com) product.
