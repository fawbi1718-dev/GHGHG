import React, { useState, useEffect } from 'react';
import { useAuth } from '../application/auth/AuthContext';
import { Building2, MapPin, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../infrastructure/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PharmacyProfile } from '../domain/tenant';

export default function PharmacySwitcher() {
 const { currentSession, activePharmacy, switchPharmacy, completeOnboarding } = useAuth();
 const [pharmacies, setPharmacies] = useState<PharmacyProfile[]>([]);
 const [isAdding, setIsAdding] = useState(false);
 const [isLoadingList, setIsLoadingList] = useState(true);
 
 // Add new pharmacy state
 const [newName, setNewName] = useState('');
 const [newLocation, setNewLocation] = useState('');
 const [newTenantType, setNewTenantType] = useState<'RETAIL_PHARMACY' | 'WHOLESALE_WAREHOUSE'>('RETAIL_PHARMACY');
 
 const isNameValid = newName.trim().length >= 3 && /^[\p{L}\p{N}\s_-]+$/u.test(newName.trim());
 const isLocationValid = newLocation.trim().length >= 5;
 const isFormValid = isNameValid && isLocationValid;

 useEffect(() => {
 async function loadPharmacies() {
 const rawIds = currentSession?.associatedTenantIds?.length 
 ? currentSession.associatedTenantIds 
 : currentSession?.ownedPharmacyIds || [];
 const idsToLoad = rawIds.filter((id: any) => id && typeof id === 'string' && id.trim() !== '');
 
 if (!idsToLoad.length) {
 setIsLoadingList(false);
 return;
 }
 setIsLoadingList(true);
 try {
 const loaded: PharmacyProfile[] = [];
 for (const pid of idsToLoad) {
 if (!pid || typeof pid !== 'string' || !pid.trim()) continue;
 // Check new tenants collection first
 let docSnap = await getDoc(doc(db, 'tenants', pid));
 if (!docSnap.exists()) {
 // Fallback to legacy pharmacies
 docSnap = await getDoc(doc(db, 'pharmacies', pid));
 }
 if (docSnap.exists()) {
 loaded.push(docSnap.data() as PharmacyProfile);
 }
 }
 setPharmacies(loaded);
 } catch (err) {
 console.warn("Failed to load pharmacies", err);
 } finally {
 setIsLoadingList(false);
 }
 }
 loadPharmacies();
 }, [currentSession?.ownedPharmacyIds, currentSession?.associatedTenantIds]);

 const handleAddNew = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newName.trim() || !newLocation.trim()) return;
 await completeOnboarding(newName, newLocation, '', newTenantType);
 setIsAdding(false);
 setNewName('');
 setNewLocation('');
 setNewTenantType('RETAIL_PHARMACY');
 };

 if (!currentSession) return null;

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
 <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
 <h3 className="font-bold text-slate-800 flex items-center gap-2">
 <Building2 className="w-4 h-4 text-emerald-500" />
 Manage Workspaces
 </h3>
 {!isAdding && (
 <button 
 onClick={() => setIsAdding(true)}
 className="text-xs flex items-center gap-1 font-bold text-emerald-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
 >
 <Plus className="w-3.5 h-3.5" />
 New Workspace
 </button>
 )}
 </div>

 <div className="p-4">
 {isLoadingList ? (
 <div className="flex justify-center p-4">
 <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
 </div>
 ) : (
 <div className="space-y-3">
 {pharmacies.map(pharmacy => (
 <div 
 key={pharmacy.id}
 onClick={() => switchPharmacy(pharmacy.id)}
 className={`p-4 rounded-xl border ${activePharmacy?.id === pharmacy.id ? 'border-emerald-500 bg-blue-50/50 ' : 'border-slate-200 hover:border-blue-300 cursor-pointer transition-colors'} flex items-center justify-between`}
 >
 <div>
 <h4 className="font-bold text-slate-800 flex items-center gap-2">
 {pharmacy.name}
 {pharmacy.tenantType === 'WHOLESALE_WAREHOUSE' ? (
 <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 ">Warehouse</span>
 ) : (
 <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 ">Retail</span>
 )}
 {activePharmacy?.id === pharmacy.id && (
 <span className="text-[10px] uppercase font-bold text-emerald-600 bg-blue-100 px-2 py-0.5 rounded-full">Active</span>
 )}
 </h4>
 <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
 <MapPin className="w-3.5 h-3.5" />
 {pharmacy.verifiedLocation || pharmacy.location?.city || 'No Location'}
 </p>
 </div>
 {activePharmacy?.id === pharmacy.id && (
 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
 )}
 </div>
 ))}
 </div>
 )}

 {isAdding && (
 <form onSubmit={handleAddNew} className="mt-4 p-4 border border-blue-200 bg-blue-50/50 rounded-xl space-y-4">
 <h4 className="text-sm font-bold text-slate-800 ">Create New Workspace</h4>
 <div className="space-y-3">
 <div>
 <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Workspace Type</label>
 <select 
 value={newTenantType}
 onChange={e => setNewTenantType(e.target.value as any)}
 className="w-full text-sm p-2 rounded-lg border border-slate-200 bg-white "
 >
 <option value="RETAIL_PHARMACY">Retail Pharmacy</option>
 <option value="WHOLESALE_WAREHOUSE">Wholesale Warehouse</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Workspace Name</label>
 <input 
 type="text" 
 value={newName}
 onChange={e => setNewName(e.target.value)}
 className={`w-full text-sm p-2 rounded-lg border ${newName && !isNameValid ? 'border-red-500' : 'border-slate-200 '} bg-white `}
 placeholder={newTenantType === 'WHOLESALE_WAREHOUSE' ? "e.g. Central Hub" : "e.g. Branch 2"}
 required
 />
 {newName && !isNameValid && <p className="text-red-500 text-[10px] mt-1">Min 3 characters, alphanumeric only.</p>}
 </div>
 <div>
 <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Location / Zone</label>
 <input 
 type="text" 
 value={newLocation}
 onChange={e => setNewLocation(e.target.value)}
 className={`w-full text-sm p-2 rounded-lg border ${newLocation && !isLocationValid ? 'border-red-500' : 'border-slate-200 '} bg-white `}
 placeholder="e.g. North District"
 required
 />
 {newLocation && !isLocationValid && <p className="text-red-500 text-[10px] mt-1">Min 5 characters required.</p>}
 </div>
 </div>
 <div className="flex gap-2 justify-end">
 <button 
 type="button" 
 onClick={() => setIsAdding(false)}
 className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 "
 >
 Cancel
 </button>
 <button 
 type="submit"
 disabled={!isFormValid}
 className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
 >
 Create Workspace
 </button>
 </div>
 </form>
 )}
 </div>
 </div>
 );
}
