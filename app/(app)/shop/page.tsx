"use client";

import { useMemo, useState } from "react";
import { shopFilters, shopItems, type MockShopItem } from "@/app/components/mockData";

type FilterType = (typeof shopFilters)[number];

function pushToast(message: string, tone: "success" | "error" | "info" = "info") {
  window.dispatchEvent(new CustomEvent("next-toast", { detail: { message, tone } }));
}

export default function ShopPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [selected, setSelected] = useState<MockShopItem | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return shopItems.filter((item) => {
      const matchesFilter = activeFilter === "All" || item.category === activeFilter;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.details.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchTerm]);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Shop</h1>
          <p className="card-muted">Redeem rewards and perks with your points.</p>
        </div>
      </header>

      <section className="card" style={{ marginTop: 14 }}>
        <label className="form" htmlFor="shop-search">
          <span>Search rewards</span>
          <input
            id="shop-search"
            className="input"
            placeholder="Search by reward name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {shopFilters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                className={active ? "btn btn-primary" : "btn btn-outline"}
                onClick={() => setActiveFilter(filter)}
                style={{ whiteSpace: "nowrap", minHeight: 36 }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="grid"
        style={{
          marginTop: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
          gap: 12,
        }}
      >
        {filteredItems.map((item) => (
          <article className="card" key={item.id}>
            <div className="chip" style={{ marginBottom: 8 }}>
              {item.highlight}
            </div>
            <h2 className="card-title" style={{ fontSize: 18 }}>
              {item.name}
            </h2>
            <p className="card-muted" style={{ marginTop: 4 }}>
              {item.category}
            </p>
            <div style={{ marginTop: 10, fontWeight: 700, color: "var(--brand-navy)" }}>{item.points} pts</div>
            <p className="card-muted" style={{ marginTop: 6 }}>
              Stock: {item.stock}
            </p>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setSelected(item)}>
                View
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => pushToast(`${item.name} redeemed successfully.`, "success")}
              >
                Redeem
              </button>
            </div>
          </article>
        ))}
      </section>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} details`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 46,
            background: "rgba(8, 16, 32, 0.52)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <article className="card" style={{ width: "min(520px, 100%)" }} onClick={(event) => event.stopPropagation()}>
            <div className="page-header">
              <div>
                <h2>{selected.name}</h2>
                <p className="card-muted">{selected.category}</p>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            <p style={{ marginTop: 14 }}>{selected.details}</p>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="chip">{selected.stock} left</span>
              <strong style={{ color: "var(--brand-navy)" }}>{selected.points} pts</strong>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                pushToast(`${selected.name} redeemed successfully.`, "success");
                setSelected(null);
              }}
            >
              Confirm Redeem
            </button>
          </article>
        </div>
      ) : null}
    </div>
  );
}
