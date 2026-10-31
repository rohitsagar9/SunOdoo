import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const prisma = new PrismaClient();

const sampleLeads = [
  // NEW
  {
    name: 'Vikramaditya Rao',
    phone: '9845012345',
    email: 'vikram.rao@gmail.com',
    address: '154 HAL 2nd Stage, Doopanahalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560008',
    requestedKw: 3,
    systemType: 'ON_GRID' as const,
    status: 'NEW' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 4800,
    roofAreaSqft: 750,
    notes: 'Independent house with south-facing RCC terrace. High daytime consumption from ACs.',
  },
  {
    name: 'Sunita Deshmukh',
    phone: '9822033445',
    email: 'sunita.d@outlook.com',
    address: 'Plot 42, Kothrud Hills',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411038',
    requestedKw: 5,
    systemType: 'ON_GRID' as const,
    status: 'NEW' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 8200,
    roofAreaSqft: 1100,
    notes: 'Wants maximum solar generation with PM Surya Ghar subsidy guidance.',
  },
  {
    name: 'Karthik Subramanian',
    phone: '9840198765',
    email: 'karthik.subbu@yahoo.in',
    address: '28 Besant Avenue, Adyar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600020',
    requestedKw: 4,
    systemType: 'ON_GRID' as const,
    status: 'NEW' as const,
    source: 'PHONE' as const,
    monthlyBill: 6400,
    roofAreaSqft: 850,
    notes: 'Interested in bifacial solar panels and micro-inverters.',
  },
  {
    name: 'Priyanka Ghosh',
    phone: '9830087654',
    email: 'priyanka.g@gmail.com',
    address: 'Block C, Salt Lake Sector 1',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700064',
    requestedKw: 2,
    systemType: 'ON_GRID' as const,
    status: 'NEW' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 3100,
    roofAreaSqft: 500,
    notes: 'Inquired through web form. Terrace is accessible via external stairs.',
  },

  // VERIFIED
  {
    name: 'Manoj Pillai',
    phone: '9847054321',
    email: 'manoj.pillai@techsol.com',
    address: 'TC 14/820, Kowdiar Gardens',
    city: 'Thiruvananthapuram',
    state: 'Kerala',
    pincode: '695003',
    requestedKw: 3,
    systemType: 'OFF_GRID' as const,
    status: 'VERIFIED' as const,
    source: 'WHATSAPP' as const,
    monthlyBill: 5800,
    roofAreaSqft: 820,
    notes: 'EB bills verified. Requires battery backup due to seasonal monsoon outages.',
  },
  {
    name: 'Harpreet Singh',
    phone: '9814067890',
    email: 'harpreet.singh@gmail.com',
    address: 'H.No 312, Model Town',
    city: 'Ludhiana',
    state: 'Punjab',
    pincode: '141002',
    requestedKw: 5,
    systemType: 'ON_GRID' as const,
    status: 'VERIFIED' as const,
    source: 'PHONE' as const,
    monthlyBill: 11500,
    roofAreaSqft: 1500,
    notes: 'Bills and roof structure verified over video call. Ready for site technician survey booking.',
  },
  {
    name: 'Deepak Chawla',
    phone: '9811045678',
    email: 'deepak.c@chawlagroup.in',
    address: 'B-4/82, Safdarjung Enclave',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110029',
    requestedKw: 4,
    systemType: 'ON_GRID' as const,
    status: 'VERIFIED' as const,
    source: 'WALK_IN' as const,
    monthlyBill: 7600,
    roofAreaSqft: 980,
    notes: 'Sanctioned load is 7 kW, single-phase to three-phase conversion in progress with discom.',
  },

  // SURVEY_SCHEDULED
  {
    name: 'Bhavna Kulkarni',
    phone: '9823078901',
    email: 'bhavna.kulkarni@gmail.com',
    address: 'Plot 19, Baner Pashan Link Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
    requestedKw: 4,
    systemType: 'ON_GRID' as const,
    status: 'SURVEY_SCHEDULED' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 6900,
    roofAreaSqft: 920,
    notes: 'Technician visit allocated for shadow analysis and cable path measurement.',
  },
  {
    name: 'Santosh Hegde',
    phone: '9845091234',
    email: 'santosh.hegde@outlook.in',
    address: '4th Cross, Malleshwaram West',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560003',
    requestedKw: 3,
    systemType: 'ON_GRID' as const,
    status: 'SURVEY_SCHEDULED' as const,
    source: 'PHONE' as const,
    monthlyBill: 4500,
    roofAreaSqft: 700,
    notes: 'Survey scheduled. Customer has high water tank on rooftop, needs elevated structure survey.',
  },

  // SURVEY_COMPLETED
  {
    name: 'Alok Nambiar',
    phone: '9846011223',
    email: 'alok.nambiar@gmail.com',
    address: 'Sea View Villa, Kadavanthra',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682020',
    requestedKw: 5,
    systemType: 'ON_GRID' as const,
    status: 'SURVEY_COMPLETED' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 9200,
    roofAreaSqft: 1350,
    notes: 'Survey completed by technician. Roof pitch 12°, South orientation, shadow-free area 1200 sq ft. Ready for quotation.',
  },
  {
    name: 'Neelam Agarwal',
    phone: '9829034567',
    email: 'neelam.agarwal@gmail.com',
    address: '74 Civil Lines, Near Raj Bhavan',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302006',
    requestedKw: 4,
    systemType: 'ON_GRID' as const,
    status: 'SURVEY_COMPLETED' as const,
    source: 'PHONE' as const,
    monthlyBill: 7800,
    roofAreaSqft: 1050,
    notes: 'Technician approved feasibility. Short cable run (14m) to meter cabin. Sales to generate quotation.',
  },

  // QUOTED
  {
    name: 'Girish Bhatt',
    phone: '9879012345',
    email: 'girish.bhatt@bhattandco.com',
    address: '102 Satellite Road, Bodakdev',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380054',
    requestedKw: 5,
    systemType: 'ON_GRID' as const,
    status: 'QUOTED' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 10400,
    roofAreaSqft: 1400,
    notes: 'Quotation sent for 5 kW Mono PERC with 5-year warranty on inverter.',
  },
  {
    name: 'Ritu Sachdeva',
    phone: '9810098123',
    email: 'ritu.sachdeva@gmail.com',
    address: 'D-14 South Extension Part 2',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110049',
    requestedKw: 3,
    systemType: 'ON_GRID' as const,
    status: 'QUOTED' as const,
    source: 'PHONE' as const,
    monthlyBill: 5600,
    roofAreaSqft: 750,
    notes: 'Quotation shared on WhatsApp. Customer evaluating net-metering timeline.',
  },

  // NEGOTIATION
  {
    name: 'Farhan Siddiqui',
    phone: '9839011223',
    email: 'farhan.siddiqui@gmail.com',
    address: '18 Hazratganj, Near Cathedral',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226001',
    requestedKw: 4,
    systemType: 'ON_GRID' as const,
    status: 'NEGOTIATION' as const,
    source: 'PHONE' as const,
    monthlyBill: 7400,
    roofAreaSqft: 950,
    notes: 'Requested 5% discount on DCR panels to finalize the order this weekend.',
  },
  {
    name: 'Venkatesh Prasad',
    phone: '9845087654',
    email: 'v.prasad@bangalore.org',
    address: '210 JP Nagar 3rd Phase',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560078',
    requestedKw: 5,
    systemType: 'OFF_GRID' as const,
    status: 'NEGOTIATION' as const,
    source: 'WHATSAPP' as const,
    monthlyBill: 11200,
    roofAreaSqft: 1300,
    notes: 'Negotiating battery capacity between 5 kWh vs 10 kWh lithium pack.',
  },

  // LOST
  {
    name: 'Ajay Srivastava',
    phone: '9838045678',
    email: 'ajay.srivastava@gmail.com',
    address: '56 Gomti Nagar Extension',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226010',
    requestedKw: 3,
    systemType: 'ON_GRID' as const,
    status: 'LOST' as const,
    source: 'WEB_FORM' as const,
    monthlyBill: 4100,
    roofAreaSqft: 600,
    lostReason: 'Commercial building adjacent is planned for 4 storeys which will completely shade the roof.',
    notes: 'Site survey revealed impending shadow obstruction from adjacent construction.',
  },
  {
    name: 'Maheshwari Naidu',
    phone: '9848034567',
    email: 'm.naidu@hyderabad.net',
    address: '68 Jubilee Hills Road No 10',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    requestedKw: 5,
    systemType: 'ON_GRID' as const,
    status: 'LOST' as const,
    source: 'PHONE' as const,
    monthlyBill: 12000,
    roofAreaSqft: 1600,
    lostReason: 'Chose competitor offering local Chinese inverter at cheaper price.',
    notes: 'Customer opted for cheaper unbranded equipment despite warranty risks.',
  },
];

async function run() {
  console.log('Seeding additional rich static leads for SunOdoo...');
  const sales = await prisma.user.findFirst({ where: { role: 'SALES' } });
  const tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });

  if (!sales) {
    throw new Error('Sales user not found in database');
  }

  const currentCount = await prisma.lead.count();
  let seq = currentCount + 1;
  const year = new Date().getFullYear();

  for (const item of sampleLeads) {
    const existing = await prisma.customer.findUnique({ where: { phone: item.phone } });
    const customer = existing
      ? existing
      : await prisma.customer.create({
          data: {
            name: item.name,
            phone: item.phone,
            email: item.email,
            address: item.address,
            city: item.city,
            state: item.state,
            pincode: item.pincode,
            monthlyBill: item.monthlyBill,
            roofAreaSqft: item.roofAreaSqft,
          },
        });

    const leadRef = `SP-L-${year}-${String(seq).padStart(4, '0')}`;
    seq += 1;

    const lead = await prisma.lead.create({
      data: {
        reference: leadRef,
        customerId: customer.id,
        requestedKw: item.requestedKw,
        systemType: item.systemType,
        status: item.status,
        source: item.source,
        assignedToId: sales.id,
        monthlyBill: item.monthlyBill,
        roofAreaSqft: item.roofAreaSqft,
        notes: item.notes,
        lostReason: item.lostReason,
      },
    });

    if (item.status === 'SURVEY_SCHEDULED' && tech) {
      await prisma.survey.create({
        data: {
          leadId: lead.id,
          technicianId: tech.id,
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          findings: 'Survey scheduled for rooftop tilt and structure check.',
        },
      });
      await prisma.job.create({
        data: {
          jobNumber: `SP-J-${year}-${String(seq).padStart(4, '0')}`,
          leadId: lead.id,
          customerId: customer.id,
          type: 'SURVEY',
          status: 'SCHEDULED',
          technicianId: tech.id,
          scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          scheduledSlot: '11:00 - 12:30',
          notes: item.notes,
        },
      });
    }

    if (item.status === 'SURVEY_COMPLETED' && tech) {
      await prisma.survey.create({
        data: {
          leadId: lead.id,
          technicianId: tech.id,
          scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          completedAt: new Date(),
          approved: true,
          roofDirection: 'South',
          tiltDegrees: 12,
          cableDistanceM: 16,
          shadowFreeAreaSqft: Math.round(item.roofAreaSqft * 0.9),
          findings: 'Ideal south-facing RCC rooftop. Approved for quotation.',
        },
      });
    }

    console.log(`Created lead ${lead.reference} (${item.status}) for ${item.name}`);
  }

  console.log('Finished seeding additional leads successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
