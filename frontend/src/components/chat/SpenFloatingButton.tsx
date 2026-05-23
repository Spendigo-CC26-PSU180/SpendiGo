export default function SpenFloatingButton() {
  return (
    <a
      href="/chat"
      className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-14 h-14 bg-white border-2 border-primary-500 rounded-full shadow-lg hover:shadow-xl hover:border-primary-600 transition-all flex items-center justify-center group"
    >
      <img
        src="/spen.png"
        alt="Chat dengan Spen"
        className="w-10 h-10 group-hover:scale-110 transition-transform"
      />
      <span className="absolute -top-8 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Chat dengan Spen
      </span>
    </a>
  );
}
