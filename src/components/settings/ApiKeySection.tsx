import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
  clearApiKeysFromStorage,
  type ApiKeys,
} from "@/lib/api-keys";

export function ApiKeySection() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>(loadApiKeysFromStorage);
  const [showKeys, setShowKeys] = useState<{
    openai: boolean;
    openrouter: boolean;
  }>({
    openai: false,
    openrouter: false,
  });
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
    setUnsavedChanges(true);
  };

  const saveApiKeys = () => {
    if (saveApiKeysToStorage(apiKeys)) {
      setUnsavedChanges(false);
      toast.success("API keys saved successfully");
    } else {
      toast.error("Failed to save API keys");
    }
  };

  const clearApiKey = (provider: keyof ApiKeys) => {
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
    setUnsavedChanges(true);
  };

  const clearAllApiKeys = () => {
    setApiKeys({ openai: "", openrouter: "" });
    clearApiKeysFromStorage();
    setUnsavedChanges(false);
    toast.success("All API keys cleared");
  };

  const toggleShowKey = (provider: keyof ApiKeys) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}${"*".repeat(4)}${key.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Manage your OpenAI and OpenRouter API keys. These are stored locally
          in your browser for security.
          <br />
          <br />
          <p className="text-xs text-muted-foreground">
            <b>Note:</b> Chat Title Generation is powered by OpenAI. O models
            require your OpenAI org to be verified. (for reasoning summaries)
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OpenAI API Key */}
        <div className="space-y-2">
          <Label htmlFor="openai-key">OpenAI API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                placeholder="sk-..."
                value={apiKeys.openai}
                onChange={(e) => handleKeyChange("openai", e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleShowKey("openai")}
                >
                  {showKeys.openai ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
                {apiKeys.openai && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => clearApiKey("openai")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {apiKeys.openai && !showKeys.openai && (
            <p className="text-xs text-muted-foreground">
              Current key: {maskKey(apiKeys.openai)}
            </p>
          )}
        </div>

        {/* OpenRouter API Key */}
        <div className="space-y-2">
          <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openrouter-key"
                type={showKeys.openrouter ? "text" : "password"}
                placeholder="sk-or-..."
                value={apiKeys.openrouter}
                onChange={(e) => handleKeyChange("openrouter", e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleShowKey("openrouter")}
                >
                  {showKeys.openrouter ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
                {apiKeys.openrouter && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => clearApiKey("openrouter")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {apiKeys.openrouter && !showKeys.openrouter && (
            <p className="text-xs text-muted-foreground">
              Current key: {maskKey(apiKeys.openrouter)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={clearAllApiKeys}
            className="gap-2"
            disabled={!apiKeys.openai && !apiKeys.openrouter}
          >
            <Trash2 className="h-4 w-4" />
            Clear All Keys
          </Button>
          <Button
            onClick={saveApiKeys}
            disabled={!unsavedChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
            {unsavedChanges && <span className="ml-1 text-xs">(unsaved)</span>}
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>
            • Your API keys are stored locally in your browser and never
            stored/logged in our servers. Don&apos;t trust this website with
            your keys? Use your own self-hosted version:{" "}
            <a
              href="https://github.com/heymaaz/t3.chat.cloneathon?tab=readme-ov-file#%EF%B8%8F-self-hosting"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              github.com/heymaaz/t3.chat.cloneathon
            </a>
          </p>
          <p>
            • Get your OpenAI API key from:{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              platform.openai.com/api-keys
            </a>
          </p>
          <p>
            • Get your OpenRouter API key from:{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              openrouter.ai/keys
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
