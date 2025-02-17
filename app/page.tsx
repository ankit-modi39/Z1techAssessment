import ImageUploader from './components/ImageUploader';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Image Resizer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your image and get it automatically resized to multiple dimensions for your advertising needs.
          </p>
        </div>
        <ImageUploader />
      </div>
    </main>
  );
}
