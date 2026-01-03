import { useParams } from "wouter";
import { AgreementDetails } from "@/components/admin/AgreementDetails";
import Layout from "@/components/Layout";

export default function UserAgreementDetailsPage() {
  const params = useParams();
  const agreementId = parseInt(params.id || "0");

  if (!agreementId) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p>Ugyldig avtale-ID</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <AgreementDetails agreementId={agreementId} isAdmin={false} />
      </div>
    </Layout>
  );
}