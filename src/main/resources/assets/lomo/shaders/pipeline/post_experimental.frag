#include frex:shaders/api/header.glsl
#extension GL_ARB_bindless_texture : require
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/post_experimental.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

#define E 0.002

float cells_for_level(int lod) {
	pow(4, level);
}

float dist_f(float v0, float lod, float d) {
	float cells = cells_for_level(lod);
	float s = sign(d);
	float fr = fract(v0/cells)*cells;
	float C = 1.01;

	if(abs(fr) <= E) return s*size*C;
	if(s > 0.0) return (size - fr)*C;
	return -fr*C;
}

float find_a(float a, float b, float p) {
	return (p - a) / (b - a);
}

struct reflection_result {
	bool success;
	vec4 color;
	float a;
};

#define CELL_SIZE 4
#define LEVELS 5
#define LAST_LEVEL ( LEVELS - 1 )

ivec2 texture_coord_for_lod(vec2 coord_lod_0, int lod) {
	return ivec2(coord_lod_0 / cells_for_level(lod));
}

reflection_result reflection(vec3 pos_cs, vec3 dir_cs, vec2 pos_ws, vec2 dir_ws) {
	mat4 proj = frx_projectionMatrix();
	mat4 view = frx_viewMatrix();

	// primary dimension in world space
	int prim_cs = abs(dir_cs.x) >= abs(dir_cs.y) ? 0 : 1;
	// z per primary in camera space, needed for math below
	float z_to_prim = 0.0;
	if(dir_cs[prim_cs] == 0.0) z_to_prim = 1/0.0000001;
	else z_to_prim = dir_cs.z / dir_cs[prim_cs];

	// it took me whole day
	float z_numerator = (pos_cs.z - z_to_prim * pos_cs[prim_cs]);
	float z_denominator = 1.0 + (z_to_prim * ((pos_ws[prim_cs] / frxu_size[prim_cs]) * 2.0 - 1.0 + proj[2][prim_cs]) / proj[prim_cs][prim_cs]);
	float z_denominator_addition = ((z_to_prim * dir_ws[prim_cs] / frxu_size[prim_cs]) * 2.0) / proj[prim_cs][prim_cs];

	// window space direction of reflected ray
	vec2 dir = dir_ws;

	// that's possible
	if(dir.x == 0) { dir.x == 0.0001; dir = normalize(dir); }
	if(dir.y == 0) { dir.y == 0.0001; dir = normalize(dir); }

	// primary dimension in window space
	int prim = abs(dir.x) >= abs(dir.y) ? 0 : 1;
	// secondary
	int sec = 1 - prim;

	ivec2 idir = ivec2(sign(dir));

	// primary per secondary
	float prim_to_sec = dir[prim] / dir[sec];
	// secondary per primary
	float sec_to_prim = dir[sec] / dir[prim];

	float dist_per_prim = 1 / dir[prim];
	float dist_per_sec = 1 / dir[sec];

	// current windows space position
	vec2 cur = pos_ws.xy + dir;
	// distance from initial position
	float dist = 1; // 1 - length of dir

	// z of upper cell
	float upper_depth_ws = 0;
	int lod = LAST_LEVEL;

	while(true) {
		// are we out of framebuffer?
		if(cur.x < 0 || cur.y <= 0 || cur.x >= frxu_size.x || cur.y >= frxu_size.y ) {
			return reflection_result(false, vec4(0), 0);
		}

		// texture coord for current lod
		ivec2 coord = texture_coord_for_lod(lod);

		// part from math abowe
		float denom = z_denominator + z_denominator_addition*dist;
		// z in camera space
		float z_cs = z_numerator / denom;
		// z in window space
		float z_ws = z_cam_to_win(z_cs, proj);

		// are we out of buffer? second case should not be possible, but who knows...
		if(z_ws >= 1 || z_ws <= 0) return reflection_result(false, vec4(0), 0);

		// should we climb to upper lod?
		while(z_ws < upper_depth_ws && lod < LAST_LEVEL ) {
			++lod;
			coord = texture_coord_for_lod(cur, lod);
			if(lod < LAST_LEVEL)
				upper_depth_ws = texelFetch(u_depth, coord, lod).r;
			else
				upper_depth_ws = 0;
		}

		// window space depth for current lod 
		float depth_ws = -1;

		// should we go down, to lower lod?
		while(true) {
			depth_ws = texelFetch(u_depth, coord, lod).r;

			// nope, we higher than cell
			if(z_ws < depth_ws) break;

			// we hit the ground
			if(lod == 0) {
				vec4 color = texelFetch(u_main, coord, 0);
				float ratio = 1;
				return reflection_result(true, color, ratio);
			}

			--lod;
			coord = texture_coord_for_lod(cur, lod);
			upper_depth_ws = depth_ws;
		}

		float depth_cs = z_win_to_cam(depth_ws, proj);
		float a = 0;
		float dist_add = 0;

		while(true) {
			float prim_dist = dist_f(cur[prim], lod, dir[prim]);
			float sec_dist = dist_f(cur[sec], lod, dir[sec]);

			float sec_to_prim0 = sec_dist / prim_dist;

			if(abs(sec_to_prim0) < abs(sec_to_prim))
				dist_add = sec_dist*dist_per_sec;
			else
				dist_add = prim_dist*dist_per_prim;

			denom = ( z_denominator + z_denominator_addition * (dist + dist_add) );
			float new_z_cs = z_numerator / denom;
			float new_z_ws = z_cam_to_win(new_z_cs, proj);

			a = find_a(z_cs, new_z_cs, depth_cs);

			bool collides = a <= 1.05;

			if(lod == 0) {
				bool collides_lod_0 = (
					// z is below depth, or
					z_ws >= depth_ws ||
					(
						// collides and new z is below depth (concern)
						collides &&
						new_z_ws >= depth_ws
					)
				);

				if(collides_lod_0) {
					vec4 color = texelFetch(u_main, coord, 0);
					float ratio = 1;
					return reflection_result(true, color/*vec4(0,0,1,0)*/, ratio);
				}

				a = 1;
				break;
			}

			bool backward = new_z_ws <= z_ws;
			if(!collides || backward) {
				a = 1;
				break;
			}

			--lod;

			coord = texture_coord_for_lod(cur, lod);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		cur += dir*dist_add*a;
		dist += dist_add*a;
	}
}

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texture2D(u_depth, _cvv_texcoord).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		mat3 rotation = mat3(view);
		vec3 normal_cs = normalize(rotation * normal);

		vec3 into_camera = normalize(-position_cs);
		float cos_between_normal_and_ray = dot(into_camera, normal_cs);
		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);//normal_cs*cos_between_normal_and_ray*2 - into_camera;

		//vec3 reflection_b_ws = cam_to_win(position_cs + reflection_dir/4, proj);

		vec2 reflection_dir_ws = dir_cam_to_win(position_cs, reflection_dir, proj);//normalize((reflection_b_ws-position_ws).xy);

		reflection_result res = reflection(position_cs, reflection_dir, position_ws.xy, reflection_dir_ws);

		if(res.success) {
			reflection_color = res.color;

			//float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
			ratio = 1;//res.a;//*sin_between_normal_and_ray;
			//return;
		}
	}

	gl_FragData[0] = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);
}