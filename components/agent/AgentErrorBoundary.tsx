"use client";

import { Component, ReactNode } from "react";
import { XCircle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class AgentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#C0392B]">
          <XCircle size={40} />
          <p className="font-semibold">Something went wrong in the agent panel</p>
          <p className="text-sm text-[#6B7280]">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="mt-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-[#111827] hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
