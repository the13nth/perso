// Simple script to test the insights API

const main = async () => {
  try {
    console.log('Testing Insights API...');
    
    const response = await fetch('http://localhost:3000/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: 'Technology',
        topWords: ['innovation', 'digital', 'software', 'data', 'systems'],
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
};

main(); 