export default function DashboardLoading() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden"
    >
      <div
        className="h-full bg-primary"
        style={{
          animation: "nav-progress 2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      />
    </div>
  );
}
