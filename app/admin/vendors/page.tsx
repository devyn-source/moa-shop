import { getVendors } from "@/lib/store";

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <main className="page">
      <p className="eyebrow">Vendors</p>
      <h1 className="page-title">Locked Factory Partners</h1>
      <p className="lede">Vendor data is local to MOA Shop and intentionally not coupled to MoaOS.</p>
      <section className="admin-grid" style={{ marginTop: 42 }}>
        {vendors.map((vendor) => (
          <div className="admin-card" key={vendor.id}>
            <h3>{vendor.name}</h3>
            <p>{vendor.country}</p>
            <p style={{ marginTop: 14 }}>{vendor.notes}</p>
            <p style={{ marginTop: 14 }}>
              {vendor.contactName}
              <br />
              {vendor.contactEmail}
              <br />
              WeChat: {vendor.contactWechat}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
