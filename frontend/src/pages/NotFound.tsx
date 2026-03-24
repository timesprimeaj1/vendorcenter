import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Search, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.1),transparent)]" />
        <motion.div
          animate={{ x: mousePos.x, y: mousePos.y }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
          className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl"
        />
        <motion.div
          animate={{ x: -mousePos.x, y: -mousePos.y }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
          className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-accent/5 blur-3xl"
        />
      </div>

      <div className="text-center max-w-lg relative z-10">
        {/* Animated 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mb-8"
        >
          <div className="text-[120px] md:text-[160px] font-display font-black leading-none bg-gradient-to-br from-primary via-[hsl(340,82%,52%)] to-primary bg-clip-text text-transparent select-none">
            404
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 border border-primary/10 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 md:w-56 md:h-56 border border-dashed border-primary/5 rounded-full"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h1 className="mb-3 text-2xl md:text-3xl font-display font-bold text-foreground">
            Page not found
          </h1>
          <p className="mb-8 text-muted-foreground max-w-sm mx-auto leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="gap-2 rounded-xl btn-press"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button asChild className="gap-2 gradient-bg text-primary-foreground border-0 rounded-xl btn-press glow-focus">
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost" className="gap-2 rounded-xl">
            <Link to="/services">
              <Search className="h-4 w-4" />
              Browse services
            </Link>
          </Button>
        </motion.div>

        {/* Fun suggestion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground/60"
        >
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "8s" }} />
          <span>Lost? Our AI assistant can help you find what you need.</span>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
