window.KamusCsvExport = {
    // Utility for fetching all rows from a Supabase table for a specific dataset
    fetchAllSupabaseRows: async function(supabaseClient, table, datasetId) {
        let allData = [];
        let from = 0;
        let limit = 1000;
        while (true) {
            const { data, error } = await supabaseClient
                .from(table)
                .select('*')
                .eq('dataset_id', datasetId)
                .range(from, from + limit - 1);
            if (error) {
                console.error("Error fetching from", table, error);
                throw error;
            }
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            from += limit;
        }
        return allData;
    },

    // Export an array of objects to CSV
    downloadCsv: function(filename, headers, rows) {
        if (!rows || !rows.length) {
            alert("No data available to export.");
            return;
        }

        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = [];
        // Add headers
        csvRows.push(headers.map(escapeCsv).join(','));

        // Add data
        for (const row of rows) {
            const rowArr = headers.map(header => row[header]);
            csvRows.push(rowArr.map(escapeCsv).join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
