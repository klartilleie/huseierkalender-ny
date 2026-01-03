import { UserAgreements } from "@/components/user/UserAgreements";
import Layout from "@/components/Layout";

export default function UserAgreementsPage() {
  return (
    <Layout>
      <div className="container mx-auto p-6">
        <UserAgreements />
      </div>
    </Layout>
  );
}