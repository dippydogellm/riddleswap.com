import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Download, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CSVImportProps {
  onImport: (data: string[]) => void;
  validateAddress?: (address: string) => boolean;
  placeholder?: string;
  acceptedFormat?: string;
}

export function CSVImport({ 
  onImport, 
  validateAddress, 
  placeholder = "Upload CSV with addresses",
  acceptedFormat = "CSV file with one address per line or comma-separated"
}: CSVImportProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        // Parse CSV: split by newlines and commas, clean up
        const addresses = text
          .split(/[\n,]/)
          .map(addr => addr.trim())
          .filter(addr => addr.length > 0);

        // Validate addresses if validator provided
        if (validateAddress) {
          const invalidAddresses = addresses.filter(addr => !validateAddress(addr));
          if (invalidAddresses.length > 0) {
            setError(`Found ${invalidAddresses.length} invalid address(es). Please check your CSV file.`);
            return;
          }
        }

        if (addresses.length === 0) {
          setError('No valid addresses found in CSV file');
          return;
        }

        onImport(addresses);
        setError(null);
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => document.getElementById('csv-upload')?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          {fileName || placeholder}
        </Button>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {acceptedFormat}
      </p>
    </div>
  );
}

interface CSVExportProps {
  data: any[];
  filename: string;
  headers?: string[];
  disabled?: boolean;
}

export function CSVExport({ data, filename, headers, disabled = false }: CSVExportProps) {
  // Helper to escape and quote CSV values
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Convert to string
    let str = String(value);
    
    // Handle arrays - convert to JSON string or semicolon-separated
    if (Array.isArray(value)) {
      str = value.join('; ');
    }
    
    // Handle objects - stringify
    if (typeof value === 'object' && !Array.isArray(value)) {
      str = JSON.stringify(value);
    }
    
    // Escape quotes by doubling them
    str = str.replace(/"/g, '""');
    
    // Quote if contains comma, newline, or quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes(';')) {
      return `"${str}"`;
    }
    
    return str;
  };

  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    let csvContent = '';

    // Add headers if provided
    if (headers && headers.length > 0) {
      csvContent = headers.map(escapeCSVValue).join(',') + '\n';
    }

    // Add data rows
    data.forEach((row) => {
      if (typeof row === 'string') {
        csvContent += escapeCSVValue(row) + '\n';
      } else if (Array.isArray(row)) {
        csvContent += row.map(escapeCSVValue).join(',') + '\n';
      } else if (typeof row === 'object') {
        const values = headers 
          ? headers.map(h => {
              const val = row[h];
              // Use nullish coalescing to preserve 0 values
              return val !== null && val !== undefined ? val : '';
            })
          : Object.values(row);
        csvContent += values.map(escapeCSVValue).join(',') + '\n';
      }
    });

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={exportToCSV}
      disabled={disabled || !data || data.length === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      Export CSV
    </Button>
  );
}

// Utility function to validate Ethereum-like addresses
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Utility function to validate Solana addresses
export function isValidSolAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Utility function to validate XRPL addresses
export function isValidXRPAddress(address: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

// Utility function to validate Bitcoin addresses
export function isValidBTCAddress(address: string): boolean {
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
}

// Get validator based on chain
export function getAddressValidator(chain: string): (address: string) => boolean {
  switch (chain.toLowerCase()) {
    case 'ethereum':
    case 'bsc':
    case 'polygon':
    case 'base':
    case 'arbitrum':
    case 'optimism':
      return isValidEthAddress;
    case 'solana':
      return isValidSolAddress;
    case 'xrpl':
      return isValidXRPAddress;
    case 'bitcoin':
      return isValidBTCAddress;
    default:
      return () => true; // No validation for unknown chains
  }
}
