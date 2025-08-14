import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';

const BloodSugarDashboard = () => {
  const [selectedView, setSelectedView] = useState('line');
  const [bloodSugarData, setBloodSugarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load and parse CSV data from Google Sheets or local file
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        setLoading(true);
        
        // Configuration - In a real project, use environment variables:
        // const GOOGLE_SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID || process.env.VITE_GOOGLE_SHEET_ID;
        
        // For artifacts/demo purposes, set your Sheet ID here:
        const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
        
        // Google Sheets CSV export URL
        const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;
        
        // Local CSV file (fallback)
        const LOCAL_CSV_URL = '/data/bloodsugar-data.csv';
        
        // Try Google Sheets first if ID is configured, otherwise use local
        let csvUrl = GOOGLE_SHEET_ID && GOOGLE_SHEET_ID.trim() !== ''
              ? GOOGLE_SHEET_URL 
              : LOCAL_CSV_URL;
        
        console.log(`Attempting to fetch data from: ${csvUrl}`);
        
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
          // If Google Sheets fails, try local file as fallback
          if (csvUrl === GOOGLE_SHEET_URL) {
            console.warn('Failed to load from Google Sheets, trying local file...');
            const fallbackResponse = await fetch(LOCAL_CSV_URL);
            if (!fallbackResponse.ok) {
              throw new Error(`Failed to load CSV file from both Google Sheets and local source. Check console for details.`);
            }
            const csvData = await fallbackResponse.text();
            parseCSV(csvData, 'local file');
          } else {
            throw new Error(`Failed to load local CSV file: ${response.status} ${response.statusText}`);
          }
        } else {
          const csvData = await response.text();
          const source = csvUrl === GOOGLE_SHEET_URL ? 'Google Sheets' : 'local file';
          parseCSV(csvData, source);
        }
        
        function parseCSV(csvData, source) {
          console.log(`Successfully loaded data from ${source}`);
          Papa.parse(csvData, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';'],
            complete: (results) => {
              if (results.errors.length > 0) {
                console.warn('CSV parsing warnings:', results.errors);
              }
              
              // Clean headers by trimming whitespace
              const cleanedData = results.data.map(row => {
                const cleanedRow = {};
                Object.keys(row).forEach(key => {
                  const cleanKey = key.trim();
                  cleanedRow[cleanKey] = row[key];
                });
                return cleanedRow;
              });
              
              console.log(`Processed ${cleanedData.length} records from ${source}`);
              setBloodSugarData(cleanedData);
              setLoading(false);
            },
            error: (error) => {
              setError(`Error parsing CSV from ${source}: ${error.message}`);
              setLoading(false);
            }
          });
        }
      } catch (err) {
        setError(`Error loading CSV file: ${err.message}`);
        setLoading(false);
      }
    };

    loadCSVData();
  }, []);

  // Process the CSV data
  const processedData = useMemo(() => {
    if (!bloodSugarData.length) return [];
    
    const processed = bloodSugarData
      .map((row, index) => {
        const date = new Date(row.date);
        return {
          id: index,
          date: date,
          dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sugarLevel: parseFloat(row.sugarLevel) || 0,
          type: row.type || 'UNKNOWN',
          time: row.time || '',
          notes: row.notes || ''
        };
      })
      .filter(item => !isNaN(item.sugarLevel) && item.sugarLevel > 0)
      .sort((a, b) => a.date - b.date);

    // Add unique display labels for multiple readings on the same day
    const dateCounts = {};
    return processed.map(item => {
      const baseDate = item.dateStr;
      dateCounts[baseDate] = (dateCounts[baseDate] || 0) + 1;
      
      // If this is not the first occurrence of this date, append the time or a counter
      if (dateCounts[baseDate] > 1) {
        const timeStr = item.time ? ` (${item.time})` : ` #${dateCounts[baseDate]}`;
        item.displayDate = `${baseDate}${timeStr}`;
      } else {
        item.displayDate = baseDate;
      }
      
      return item;
    });
  }, [bloodSugarData]);

  // Separate data by type
  const fastingData = processedData.filter(d => d.type === 'FASTING');
  const randomData = processedData.filter(d => d.type === 'RANDOM');

  // Calculate statistics
  const stats = useMemo(() => {
    if (!processedData.length) {
      return {
        overall: { avg: 'N/A', max: 'N/A', min: 'N/A', count: 0 },
        fasting: { avg: 'N/A', max: 'N/A', min: 'N/A', count: 0 },
        random: { avg: 'N/A', max: 'N/A', min: 'N/A', count: 0 }
      };
    }

    const allLevels = processedData.map(d => d.sugarLevel);
    const fastingLevels = fastingData.map(d => d.sugarLevel);
    const randomLevels = randomData.map(d => d.sugarLevel);

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = arr => Math.max(...arr);
    const min = arr => Math.min(...arr);

    return {
      overall: {
        avg: avg(allLevels).toFixed(1),
        max: max(allLevels),
        min: min(allLevels),
        count: allLevels.length
      },
      fasting: {
        avg: fastingLevels.length ? avg(fastingLevels).toFixed(1) : 'N/A',
        max: fastingLevels.length ? max(fastingLevels) : 'N/A',
        min: fastingLevels.length ? min(fastingLevels) : 'N/A',
        count: fastingLevels.length
      },
      random: {
        avg: randomLevels.length ? avg(randomLevels).toFixed(1) : 'N/A',
        max: randomLevels.length ? max(randomLevels) : 'N/A',
        min: randomLevels.length ? min(randomLevels) : 'N/A',
        count: randomLevels.length
      }
    };
  }, [processedData, fastingData, randomData]);

  // Fixed Custom tooltip - now properly handles multiple readings per day
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Get the data from the payload - this should now work correctly with unique display dates
      const data = payload[0].payload;
      
      if (data) {
        return (
          <div className="bg-white p-3 border rounded shadow-lg">
            <p className="font-medium">{`Date: ${data.dateStr}`}</p>
            <p className="text-blue-600">{`Sugar Level: ${data.sugarLevel} mg/dL`}</p>
            <p className="text-sm text-gray-600">{`Type: ${data.type}`}</p>
            {data.time && <p className="text-sm text-gray-600">{`Time: ${data.time}`}</p>}
            {data.notes && <p className="text-sm text-gray-500">{`Notes: ${data.notes}`}</p>}
          </div>
        );
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading blood sugar data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-red-500 mt-2">
            Make sure your Google Sheet is publicly accessible or that your CSV file is located at <code>public/data/bloodsugar-data.csv</code> and contains the expected columns: date, sugarLevel, type, time, notes
          </p>
        </div>
      </div>
    );
  }

  if (!processedData.length) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-yellow-800 font-semibold mb-2">No Data Found</h2>
          <p className="text-yellow-600">No valid blood sugar data was found in the CSV file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Blood Sugar Analysis Dashboard</h1>
        <p className="text-gray-600">Tracking blood glucose levels ({processedData.length} readings loaded)</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Overall Stats</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Average:</span> {stats.overall.avg} mg/dL</p>
            <p><span className="font-medium">Highest:</span> {stats.overall.max} mg/dL</p>
            <p><span className="font-medium">Lowest:</span> {stats.overall.min} mg/dL</p>
            <p><span className="font-medium">Total readings:</span> {stats.overall.count}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-blue-600 mb-4">Fasting Levels</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Average:</span> {stats.fasting.avg} mg/dL</p>
            <p><span className="font-medium">Highest:</span> {stats.fasting.max} mg/dL</p>
            <p><span className="font-medium">Lowest:</span> {stats.fasting.min} mg/dL</p>
            <p><span className="font-medium">Readings:</span> {stats.fasting.count}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semiberer text-green-600 mb-4">Random Levels</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Average:</span> {stats.random.avg} mg/dL</p>
            <p><span className="font-medium">Highest:</span> {stats.random.max} mg/dL</p>
            <p><span className="font-medium">Lowest:</span> {stats.random.min} mg/dL</p>
            <p><span className="font-medium">Readings:</span> {stats.random.count}</p>
          </div>
        </div>
      </div>

      {/* View Selection */}
      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedView('line')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedView === 'line' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Line Chart
          </button>
          <button
            onClick={() => setSelectedView('bar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedView === 'bar' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Bar Chart
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Blood Sugar Levels Over Time</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {selectedView === 'line' ? (
              <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[80, 320]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                <Line 
                  type="monotone" 
                  dataKey="sugarLevel" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                  name="Blood Sugar Level"
                />
                
                {/* Reference lines */}
                <Line 
                  type="monotone" 
                  dataKey={() => 100} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                  name="Normal Fasting (100)"
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 140} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                  name="Pre-diabetic (140)"
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 200} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                  name="Diabetic (200)"
                />
              </LineChart>
            ) : (
              <BarChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[80, 320]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="sugarLevel" 
                  fill="#2563eb"
                  name="Blood Sugar Level"
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Separate charts by type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-blue-600 mb-4">Fasting Levels ({fastingData.length} readings)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fastingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[80, 280]} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="sugarLevel" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 100} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 126} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-green-600 mb-4">Random Levels ({randomData.length} readings)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={randomData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" />
                <YAxis domain={[80, 320]} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="sugarLevel" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 140} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey={() => 200} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reference Information */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Reference Ranges</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-600 mb-2">Fasting Blood Sugar</h4>
            <ul className="text-sm space-y-1">
              <li><span className="inline-block w-4 h-4 bg-green-500 mr-2 rounded"></span>Normal: Less than 100 mg/dL</li>
              <li><span className="inline-block w-4 h-4 bg-yellow-500 mr-2 rounded"></span>Pre-diabetes: 100-125 mg/dL</li>
              <li><span className="inline-block w-4 h-4 bg-red-500 mr-2 rounded"></span>Diabetes: 126 mg/dL or higher</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-green-600 mb-2">Random Blood Sugar</h4>
            <ul className="text-sm space-y-1">
              <li><span className="inline-block w-4 h-4 bg-green-500 mr-2 rounded"></span>Normal: Less than 140 mg/dL</li>
              <li><span className="inline-block w-4 h-4 bg-yellow-500 mr-2 rounded"></span>Pre-diabetes: 140-199 mg/dL</li>
              <li><span className="inline-block w-4 h-4 bg-red-500 mr-2 rounded"></span>Diabetes: 200 mg/dL or higher</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BloodSugarDashboard;