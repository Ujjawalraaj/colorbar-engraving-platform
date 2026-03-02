const getStatusColor = (status) => {
  if (status === 'Pending') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (status === 'Processing') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (status === 'Completed') return 'bg-green-100 text-green-800 border-green-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
};

export default getStatusColor;
