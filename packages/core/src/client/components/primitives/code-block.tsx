import type { ComponentProps } from "react";
import { cn } from "../../utils/cn";

interface CodeBlockRootProps extends ComponentProps<"div"> {
    /**
     * Whether the code block is in plain mode (no borders/padding)
     * @default false
     */
    plain?: boolean;
}

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
                    'my-6 rounded-lg border border-border-subtle': !plain,
                },
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

type CodeBlockHeaderProps = ComponentProps<"div">;

const CodeBlockHeader = ({
    children,
    className,
    ...props
}: CodeBlockHeaderProps) => {
    return (
        <div
            className={cn(
                "flex h-9 items-center justify-between px-4 py-1.5",
                "text-[13px] font-medium text-text-muted",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
};

type CodeBlockGroupProps = ComponentProps<"div">;

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

interface CodeBlockContentProps extends ComponentProps<"div"> {
    /**
     * Whether the code should be truncated with an expand button
     * @default false
     */
    shouldTruncate?: boolean;
}

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

export {
    CodeBlock,
    CodeBlockHeader,
    CodeBlockGroup,
    CodeBlockContent,
};