import { AdminAgreements } from "@/components/admin/AdminAgreements";
import Layout from "@/components/Layout";

export default function AdminAgreementsPage() {
  return (
    <Layout>
      <div className="container mx-auto p-6">
        <AdminAgreements />
      </div>
    </Layout>
  );
}