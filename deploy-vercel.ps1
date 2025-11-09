# 🚀 Quick Deploy to Vercel - Windows PowerShell

Write-Host "🎯 Starting RiddleSwap Production Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if vercel CLI is installed
$vercelExists = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelExists) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

Write-Host "✅ Vercel CLI ready" -ForegroundColor Green
Write-Host ""

# Login check
Write-Host "🔐 Checking Vercel authentication..." -ForegroundColor Yellow
vercel whoami
if ($LASTEXITCODE -ne 0) {
    vercel login
}

Write-Host ""
Write-Host "📦 Building project locally first..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed. Please fix errors before deploying." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🌍 Deploying to Vercel..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Choose deployment type:" -ForegroundColor Yellow
Write-Host "1) Preview deployment (safe test)"
Write-Host "2) Production deployment"
Write-Host ""

$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host "📸 Creating preview deployment..." -ForegroundColor Cyan
    vercel
} elseif ($choice -eq "2") {
    Write-Host "🚀 Deploying to PRODUCTION..." -ForegroundColor Yellow
    Write-Host "⚠️  This will update the live site!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -eq "yes") {
        vercel --prod
        Write-Host ""
        Write-Host "✅ Production deployment complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Next steps:" -ForegroundColor Cyan
        Write-Host "1. Test all features on production URL"
        Write-Host "2. Monitor logs: vercel logs --follow"
        Write-Host "3. Check analytics: vercel.com/dashboard"
    } else {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "❌ Invalid choice" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Don't forget to:" -ForegroundColor Yellow
Write-Host "  - Set environment variables in Vercel dashboard"
Write-Host "  - Enable rate limiting in production"
Write-Host "  - Test wallet functionality"
Write-Host "  - Test swap system"
Write-Host "  - Monitor error logs"
