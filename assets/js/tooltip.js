document.addEventListener("DOMContentLoaded", function () {
    const statusTooltipElements = document.querySelectorAll(".status-tooltip");
    statusTooltipElements.forEach(tooltip => {
        tooltip.addEventListener("mouseover", () => {
            const tooltipText = tooltip.getAttribute("data-tooltip");
            const tooltipBox = document.createElement("div");
            tooltipBox.classList.add("status-tooltip-box");
            tooltipBox.innerText = getTooltipContent(tooltipText);
            tooltip.appendChild(tooltipBox);
        });

        tooltip.addEventListener("mouseout", () => {
            const tooltipBox = tooltip.querySelector(".status-tooltip-box");
            if (tooltipBox) tooltip.removeChild(tooltipBox);
        });

        tooltip.addEventListener("mousemove", (event) => {
            const tooltipBox = tooltip.querySelector(".status-tooltip-box");
            if (tooltipBox) {
                const boxRect = tooltipBox.getBoundingClientRect();
                const contentLength = tooltipBox.innerText.length;
                const offset = contentLength < 125 ? 100 : 200;
                const tooltipLeft = Math.max(0, event.clientX + offset);
                tooltipBox.style.left = tooltipLeft + "px";
                tooltipBox.style.maxWidth = (window.innerWidth - event.clientX) * 2 + "px";
            }
        });

    });
});

function getTooltipContent(status) {
    const statusMeanings = {
        Draft: "⚠️ The formal starting point of a HIP. The HIP is currently being drafted and is not yet ready for review.",
        Review: "📖 The HIP is ready for review by the community and HIP editors.",
        "Last Call": "📢 The HIP is in a final review window, typically 14 days, before being moved to a Hiero TSC approval vote (Service, Core, Mirror or Block Node HIPs) or Active (Application HIPs).",
        Approved: "👍 A Standards Track HIP has been approved by Hiero TSC.",
        Final: "✅ A Standards Track HIP has been reviewed and approved by Hiero TSC and its reference implementation has been merged.",
        Active: "🌟 A Process or Informational HIP that is currently in effect.",
        Deferred: "⏸ A HIP that is not currently being pursued but may be revisited in the future.",
        Withdrawn: "🛑 Author has withdrawn the HIP.",
        Stagnant: "🚧 A HIP that has been inactive for a significant period (e.g., 6+ months) may be marked as Stagnant by the HIP editors.",
        Rejected: "❌ The HIP has been rejected by the HIP editors, the community, or a Hiero TSC vote.",
        Replaced: "🔄 The HIP has been replaced by a newer HIP."
      };
    return statusMeanings[status] || "No information available for this status.";
}