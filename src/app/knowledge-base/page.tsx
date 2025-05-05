'use client';

import { useEffect, useState } from 'react';
import { FileUploadDropzone } from '@/components/knowledge-base/FileUploadDropzone';
import { FileListTable } from '@/components/knowledge-base/FileListTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function KnowledgeBasePage() {
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserOrganisation() {
      setIsLoadingOrg(true);
      setError(null);
      try {
        console.log("Fetching user organisation context...");
        await new Promise(resolve => setTimeout(resolve, 500));
        const simulatedOrgId = "org_placeholder_123";
        if (!simulatedOrgId) {
           throw new Error('Could not determine user organisation.');
        }
        setUserOrgId(simulatedOrgId);
      } catch (err) {
        console.error("Failed to fetch user organisation context:", err);
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        setError(`Failed to load context: ${message}`);
        toast.error(`Failed to load context: ${message}`);
        setUserOrgId(null);
      } finally {
        setIsLoadingOrg(false);
      }
    }

    fetchUserOrganisation();
  }, []);

  if (isLoadingOrg) {
    return <div className="container mx-auto p-4"><p>Loading user context...</p></div>;
  }

  if (error) {
    return <div className="container mx-auto p-4"><p className="text-red-500">Error: {error}</p></div>;
  }

  if (!userOrgId) {
    return <div className="container mx-auto p-4"><p>Could not determine your organisation context.</p></div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Knowledge Base</h1>

      <>
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploadDropzone organisationId={userOrgId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <FileListTable organisationId={userOrgId} />
          </CardContent>
        </Card>
      </>
    </div>
  );
} 