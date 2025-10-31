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
        Draft: "✏️ The formal starting point of a HIP. Currently being drafted and not yet ready for review.",
        Review: "📖 Ready for review by the community and HIP editors. Subject to changes; feedback appreciated.",
        "Last Call": "📢 Final review window (typically 14 days) before moving to Hiero TSC approval or Approved status.",
        Approved: "✅ Standards Track HIP approved by Hiero TSC, or Application HIP approved by community. Awaits Hedera review if needed.",
        Final: "🎯 Standards Track HIP with reference implementation merged and code released.",
        Active: "🌟 Process or Informational HIP that is currently in effect. Can be Withdrawn or Replaced.",
        Deferred: "⏸️ Not currently being pursued but may be revisited in the future.",
        Withdrawn: "🛑 Withdrawn by the Author(s). Can be resurrected as a new proposal.",
        Stagnant: "🚧 No activity for 6+ months. Can return to Draft by Authors or Editors.",
        Rejected: "❌ Rejected by HIP editors, community, or Hiero TSC vote. Ideas recorded with reasoning.",
        Replaced: "🔄 Overwritten by a newer standard or implementation."
      };
    return statusMeanings[status] || "No information available for this status.";
}