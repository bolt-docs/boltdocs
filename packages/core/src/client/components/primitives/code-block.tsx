import type { ComponentProps } from "react";
import { cn } from "../../utils/cn";

interface CodeBlockRootProps extends ComponentProps<"div"> {
    /**
     * Whether the code block is in plain mode (no borders/padding)
     * @default false
     */
    plain?: boolean;
}

export interface CodeBlockHeaderProps extends ComponentProps<"div"> {}
export interface CodeBlockGroupProps extends ComponentProps<"div"> {}
export interface CodeBlockContentProps extends ComponentProps<"div"> {
    /**
     * Whether the code content should be truncated with an expand button
     * @default false
     */
    shouldTruncate?: boolean;
}

/**
 * Root component for code blocks.
 * Handles background, borders, and general layout.
 */
const CodeBlock = ({
    children,
    className,
    plain = false,
    ...props
}: CodeBlockRootProps) => {
    return (
        <div
            className={cn(
                "not-prose boltdocs-code-block",
                'group relative overflow-hidden bg-(--color-code-bg)',
                'contain-layout contain-paint',
                {
                    'my-6 rounded-lg border border-subtle': !plain,
                },
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

/**
 * Header section of the code block.
 * Usually contains the title, language label, and action buttons.
 */
const CodeBlockHeader = ({
    children,
    className,
    ...props
}: CodeBlockHeaderProps) => {
    return (
        <div
            className={cn(
                "flex h-9 items-center justify-between px-4 py-1.5",
                "text-[13px] font-medium text-muted",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

/**
 * Horizontal group for organizing items within the header (e.g., logo + label).
 */
const CodeBlockGroup = ({
    children,
    className,
    ...props
}: CodeBlockGroupProps) => {
    return (
        <div
            className={cn(
                "flex items-center space-x-2",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

/**
 * Content area of the code block.
 * Wraps the `<pre>` or `<div>` containing the code.
 */
const CodeBlockContent = ({
    className,
    children,
    shouldTruncate = false,
    ...props
}: CodeBlockContentProps) => {
    return (
        <div
            className={cn(
                "relative",
                {
                    '[&>pre]:max-h-[300px] [&>pre]:overflow-hidden [&>div>pre]:max-h-[300px] [&>div>pre]:overflow-hidden': shouldTruncate,
                },
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

// Assign sub-components
CodeBlock.Header = CodeBlockHeader;
CodeBlock.Group = CodeBlockGroup;
CodeBlock.Content = CodeBlockContent;

export {
    CodeBlock,
    CodeBlockHeader,
    CodeBlockGroup,
    CodeBlockContent,
};